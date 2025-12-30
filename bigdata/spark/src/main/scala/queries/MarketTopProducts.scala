package com.bigdata.sales.queries

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.streaming.{StreamingQuery, Trigger}
import com.mongodb.client.model.{ReplaceOptions, BulkWriteOptions}
import org.bson.Document
import java.util
import com.bigdata.sales.utils.MongoWriter

object MarketTopProducts {
  
  def createAggregation(enrichedSaleItems: DataFrame): DataFrame = {
    enrichedSaleItems
      .withWatermark("saleTime", "2 minutes")
      .groupBy(
        window(col("saleTime"), "1 minute"),
        col("productId"),
        col("sector")
      )
      .agg(
        sum("subtotal").alias("totalRevenue"),
        sum("quantity").alias("totalQuantity"),
        first(when(col("productName").isNotNull, col("productName")).otherwise(lit(null))).alias("productName"),
        first(when(col("brand").isNotNull, col("brand")).otherwise(lit(null))).alias("brand"),
        avg("price").alias("avgPrice")
      )
      .filter(col("productId").isNotNull)
  }
  
  def writeToMongo(batchDF: DataFrame, batchId: Long, mongoUri: String): Unit = {
    val timestamp = new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date())
    println(s"\n[$timestamp] [Query3] Market Top Products - Batch $batchId")
    println(s"[Query3] Reading from spark_company_top_products collection...")
    
    try {
      val mongoClient = MongoWriter.createMongoClient(mongoUri)
      val database = mongoClient.getDatabase("bigdata")
      val companyTopProductsCollection = database.getCollection("spark_company_top_products")
      val marketTopProductsCollection = database.getCollection("spark_market_analytics_top_products")
      
      val allProducts = companyTopProductsCollection.find().iterator()
      val collectionCount = companyTopProductsCollection.countDocuments()
      println(s"[Query3] Found $collectionCount documents in spark_company_top_products collection")
      
      val productStats = scala.collection.mutable.Map[(String, String), (Double, Long, String, String)]()
      var productCount = 0
      
      while (allProducts.hasNext) {
        val productDoc = allProducts.next()
        val sector = MongoWriter.safeGetString(productDoc, "sector")
        val productId = MongoWriter.safeGetString(productDoc, "productId")
        val revenue = MongoWriter.safeGetDouble(productDoc, "totalRevenue")
        val quantity = MongoWriter.safeGetLong(productDoc, "totalQuantity")
        val productName = MongoWriter.safeGetString(productDoc, "productName")
        val brand = MongoWriter.safeGetString(productDoc, "brand")
        
        if (sector != null && productId != null) {
          val key = (sector, productId)
          val current = productStats.getOrElse(key, (0.0, 0L, productName, brand))
          val newTotalRevenue = current._1 + revenue
          val newTotalQuantity = current._2 + quantity
          val finalProductName = if (current._3 != null) current._3 else productName
          val finalBrand = if (current._4 != null) current._4 else brand
          
          productStats(key) = (newTotalRevenue, newTotalQuantity, finalProductName, finalBrand)
          productCount += 1
        }
      }
      
      val bulkOps = new util.ArrayList[com.mongodb.client.model.WriteModel[Document]]()
      var savedCount = 0
      val savedSectors = scala.collection.mutable.Set[String]()
      
      productStats.foreach { case ((sector, productId), (totalRevenue, totalQuantity, productName, brand)) =>
        val filter = new Document("sector", sector).append("productId", productId)
        val existingDoc = marketTopProductsCollection.find(filter).first()
        
        val existingAvgPrice = MongoWriter.safeGetDouble(existingDoc, "avgPrice")
        val existingQty = MongoWriter.safeGetLong(existingDoc, "totalQuantity")
        
        val totalQty = existingQty + totalQuantity
        val finalAvgPrice = if (totalQty > 0 && existingQty > 0) {
          ((existingAvgPrice * existingQty.toDouble) + ((totalRevenue / totalQuantity.toDouble) * totalQuantity.toDouble)) / totalQty.toDouble
        } else if (totalQuantity > 0) {
          totalRevenue / totalQuantity.toDouble
        } else {
          0.0
        }
        
        val doc = new Document()
        doc.append("sector", sector)
        doc.append("productId", productId)
        if (productName != null) doc.append("productName", productName)
        if (brand != null) doc.append("brand", brand)
        doc.append("totalRevenue", totalRevenue)
        doc.append("totalQuantity", totalQuantity)
        doc.append("avgPrice", finalAvgPrice)
        doc.append("updatedAt", new java.util.Date())
        
        bulkOps.add(new com.mongodb.client.model.ReplaceOneModel(filter, doc, new ReplaceOptions().upsert(true)))
        savedCount += 1
        savedSectors.add(sector)
      }
      
      MongoWriter.bulkWrite(marketTopProductsCollection, bulkOps)
      mongoClient.close()
      if (savedCount > 0) {
        println(s"[Query3] SUCCESS: Processed $productCount company products, saved $savedCount Market Top Products (sectors: ${savedSectors.mkString(", ")})")
      } else {
        println(s"[Query3] WARNING: No data to save - spark_company_top_products collection is empty")
      }
    } catch {
      case e: Exception =>
        println(s"[Query3] ERROR: Failed to process Market Top Products: ${e.getMessage}")
        e.printStackTrace()
    }
  }
  
  def createQuery(spark: SparkSession, mongoUri: String): StreamingQuery = {
    spark
      .readStream
      .format("rate")
      .option("rowsPerSecond", 1)
      .load()
      .writeStream
      .outputMode("append")
      .option("checkpointLocation", "file:///tmp/spark-checkpoints/market-top-products")
      .foreachBatch { (batchDF: DataFrame, batchId: Long) =>
        writeToMongo(batchDF, batchId, mongoUri)
      }
      .trigger(Trigger.ProcessingTime("1 minute"))
      .start()
  }
}

