package com.bigdata.sales

import org.apache.spark.sql.SparkSession
import org.apache.spark.sql.functions._
import org.apache.spark.sql.streaming.StreamingQuery
import org.apache.log4j.{Logger, Level}

import com.bigdata.sales.schemas.SalesSchemas
import com.bigdata.sales.queries._
import com.bigdata.sales.CountMinSketch

object SalesStreaming {
  
  def main(args: Array[String]): Unit = {
    
    val spark = SparkSession.builder
      .appName("SalesStreaming")
      .master("local[8]")
      .config("spark.mongodb.input.uri", "mongodb://localhost:27017/bigdata")
      .config("spark.mongodb.output.uri", "mongodb://localhost:27017/bigdata")
      .config("spark.sql.streaming.checkpointLocation", "file:///tmp/spark-checkpoints")
      .config("spark.local.dir", "D:/tmp/spark-temp")
      .config("spark.local.dirs", "D:/tmp/spark-temp")
      .config("spark.sql.shuffle.partitions", "16")
      .config("spark.sql.streaming.maxBatchesToRetain", "20")
      .config("spark.sql.streaming.stateStore.stateSchemaCheck", "false")
      .config("spark.sql.streaming.minBatchesToRetain", "2")
      .config("spark.executor.memory", "6g")
      .config("spark.driver.memory", "2g")
      .config("spark.memory.fraction", "0.8")
      .config("spark.memory.storageFraction", "0.3")
      .config("spark.sql.streaming.streamingQueryListeners", "")
      .config("spark.sql.adaptive.enabled", "false")
      .getOrCreate()
    
    spark.sparkContext.setLogLevel("WARN")
    Logger.getLogger("org.apache.spark.sql.execution.streaming.state.HDFSBackedStateStoreProvider").setLevel(Level.ERROR)
    
    import spark.implicits._
    
    val mongoUri = "mongodb://localhost:27017/bigdata"
    
    println("[SalesStreaming] Loading Products and Employees from MongoDB...")
    
    val productsDF = try {
      spark.read
        .format("mongo")
        .option("uri", mongoUri)
        .option("collection", "products")
        .load()
        .select(
          col("_id").cast("string").alias("productId"),
          col("productName"),
          col("brand"),
          col("productPrice"),
          col("categoryId")
        )
        .cache()
    } catch {
      case e: Exception =>
        println(s"[SalesStreaming] WARNING: Could not load Products from MongoDB: ${e.getMessage}")
        spark.emptyDataFrame
    }
    
    val employeesDF = try {
      spark.read
        .format("mongo")
        .option("uri", mongoUri)
        .option("collection", "employees")
        .load()
        .select(
          col("_id").alias("employeeId"),
          col("employeeName"),
          col("position"),
          col("companyId")
        )
        .cache()
    } catch {
      case e: Exception =>
        println(s"[SalesStreaming] WARNING: Could not load Employees from MongoDB: ${e.getMessage}")
        spark.emptyDataFrame
    }
    
    val productsCount = try { 
      if (productsDF.columns.isEmpty) 0L else productsDF.count() 
    } catch { 
      case _: Exception => 0L 
    }
    val employeesCount = try { 
      if (employeesDF.columns.isEmpty) 0L else employeesDF.count() 
    } catch { 
      case _: Exception => 0L 
    }
    println(s"[SalesStreaming] Loaded ${productsCount} products and ${employeesCount} employees")
    
    val kafkaSalesDF = spark
      .readStream
      .format("kafka")
      .option("kafka.bootstrap.servers", "localhost:9092")
      .option("subscribe", "sales")
      .option("startingOffsets", "latest")
      .load()
    
    val kafkaSaleItemsDF = spark
      .readStream
      .format("kafka")
      .option("kafka.bootstrap.servers", "localhost:9092")
      .option("subscribe", "sale_items")
      .option("startingOffsets", "latest")
      .load()
    
    val salesDF = kafkaSalesDF
      .select(
        from_json(col("value").cast("string"), SalesSchemas.salesSchema).alias("data"),
        col("timestamp").alias("kafka_timestamp")
      )
      .select("data.*", "kafka_timestamp")
    
    val saleItemsDF = kafkaSaleItemsDF
      .select(
        from_json(col("value").cast("string"), SalesSchemas.saleItemSchema).alias("data"),
        col("timestamp").alias("kafka_timestamp")
      )
      .select("data.*", "kafka_timestamp")
    
    val completedSales = salesDF.filter(col("saleStatus") === "completed")
    
    val productSketch = CountMinSketch.createDefault
    val citySketch = CountMinSketch.createDefault
    
    println(s"[SalesStreaming] Count-Min Sketch initialized (Memory: ~${productSketch.getMemoryUsage / 1024} KB per sketch)")
    
    val enrichedSaleItems = if (productsCount > 0) {
      saleItemsDF
        .filter(col("sector").isNotNull)
        .join(
          productsDF,
          saleItemsDF("productId") === productsDF("productId"),
          "left"
        )
    } else {
      println("[SalesStreaming] ProductsDF is empty, using saleItemsDF with brand from sale_items")
      saleItemsDF
        .filter(col("sector").isNotNull)
        .withColumn("productName", lit(null).cast("string"))
    }
    
    val enrichedSales = if (employeesCount > 0) {
      completedSales
        .join(
          employeesDF,
          completedSales("employeeId") === employeesDF("employeeId"),
          "left"
        )
    } else {
      println("[SalesStreaming] EmployeesDF is empty, using completedSales without enrichment")
      completedSales
    }
    
    val saleItemsWithWatermark = saleItemsDF
      .filter(col("sector").isNotNull && col("brand").isNotNull && col("brand") =!= "")
      .withWatermark("saleTime", "2 minutes")
    
    val completedSalesWithWatermark = completedSales
      .withWatermark("saleTime", "2 minutes")
    
    val sectorAggregations = SectorAggregations.createAggregation(completedSales)
    val regionAggregations = RegionAggregations.createAggregation(completedSales)
    val marketTopProducts = MarketTopProducts.createAggregation(enrichedSaleItems)
    val companyTopProducts = CompanyTopProducts.createAggregation(enrichedSaleItems)
    val marketTopBrands = MarketTopBrands.createAggregation(enrichedSaleItems)
    val marketEmployeePerformance = MarketEmployeePerformance.createAggregation(enrichedSales)
    val companyAnalytics = CompanyAnalytics.createAggregation(completedSales)
    val marketAnalytics = MarketAnalytics.createAggregation(completedSales)
    val companyBrandsAnalytics = CompanyBrandsAnalytics.createAggregation(
      saleItemsWithWatermark,
      completedSalesWithWatermark,
      productsDF,
      productsCount
    )
    val companyEmployeesAnalytics = CompanyEmployeesAnalytics.createAggregation(
      completedSales,
      employeesDF,
      employeesCount
    )
    
    val query1 = SectorAggregations.createQuery(sectorAggregations, mongoUri, productSketch)
    val query2 = RegionAggregations.createQuery(regionAggregations, mongoUri, citySketch)
    val query3 = MarketTopProducts.createQuery(spark, mongoUri)
    val query4 = CompanyTopProducts.createQuery(companyTopProducts, mongoUri)
    val query5 = MarketTopBrands.createQuery(marketTopBrands, mongoUri)
    val query6 = MarketEmployeePerformance.createQuery(spark, mongoUri)
    val query7 = CompanyAnalytics.createQuery(companyAnalytics, mongoUri)
    val query8 = MarketAnalytics.createQuery(marketAnalytics, mongoUri)
    val query9 = CompanyBrandsAnalytics.createQuery(companyBrandsAnalytics, mongoUri)
    val query10 = CompanyEmployeesAnalytics.createQuery(companyEmployeesAnalytics, mongoUri)
    
    println("[Query3] Started - Market Top Products")
    println("[Query6] Started - Market Employee Performance")
    
    println("[SalesStreaming] Spark Streaming started")
    println("[SalesStreaming] Processing sales data from Kafka...")
    println("[SalesStreaming] Starting 10 streaming queries:")
    println("  Query 1: Sales by Sector")
    println("  Query 2: Sales by Region")
    println("  Query 3: Market Top Products")
    println("  Query 4: Company Top Products")
    println("  Query 5: Market Top Brands")
    println("  Query 6: Market Employee Performance")
    println("  Query 7: Company Analytics")
    println("  Query 8: Market Analytics")
    println("  Query 9: Company Brands Analytics")
    println("  Query 10: Company Employees Analytics")
    println("[SalesStreaming] Waiting for data... (Make sure Kafka has messages)")
    
    try {
      query1.awaitTermination()
    } catch {
      case e: Exception =>
        println(s"[SalesStreaming] ERROR: Query stopped with error: ${e.getMessage}")
        e.printStackTrace()
    } finally {
      println("[SalesStreaming] Stopping all queries...")
      query1.stop()
      query2.stop()
      query3.stop()
      query4.stop()
      query5.stop()
      query6.stop()
      query7.stop()
      query8.stop()
      query9.stop()
      query10.stop()
      spark.stop()
    }
  }
}
