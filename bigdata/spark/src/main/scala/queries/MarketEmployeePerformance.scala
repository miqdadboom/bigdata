package com.bigdata.sales.queries

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.streaming.{StreamingQuery, Trigger}
import com.mongodb.client.model.{ReplaceOptions, BulkWriteOptions}
import org.bson.Document
import java.util
import com.bigdata.sales.utils.MongoWriter

object MarketEmployeePerformance {
  
  def createAggregation(enrichedSales: DataFrame): DataFrame = {
    enrichedSales
      .withWatermark("saleTime", "2 minutes")
      .groupBy(
        window(col("saleTime"), "1 minute"),
        col("sector")
      )
      .agg(
        avg("totalAmount").alias("avgSaleAmount"),
        count("*").alias("totalSales"),
        approx_count_distinct("employeeId").alias("totalEmployees")
      )
  }
  
  def writeToMongo(batchDF: DataFrame, batchId: Long, mongoUri: String): Unit = {
    val timestamp = new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date())
    println(s"\n[$timestamp] [Query6] Market Employee Performance - Batch $batchId")
    println(s"[Query6] Reading from spark_company_employees collection...")
    
    try {
      val mongoClient = MongoWriter.createMongoClient(mongoUri)
      val database = mongoClient.getDatabase("bigdata")
      val companyEmployeesCollection = database.getCollection("spark_company_employees")
      val marketEmployeeCollection = database.getCollection("spark_market_analytics_employee_performance")
      
      val allEmployees = companyEmployeesCollection.find().iterator()
      val collectionCount = companyEmployeesCollection.countDocuments()
      println(s"[Query6] Found $collectionCount documents in spark_company_employees collection")
      
      val sectorStats = scala.collection.mutable.Map[String, (Long, Double, Long)]()
      val sectorEmployees = scala.collection.mutable.Map[String, scala.collection.mutable.Set[String]]()
      var employeeCount = 0
      
      while (allEmployees.hasNext) {
        val employeeDoc = allEmployees.next()
        val sector = MongoWriter.safeGetString(employeeDoc, "sector")
        val salesCount = MongoWriter.safeGetLong(employeeDoc, "salesCount")
        val revenue = MongoWriter.safeGetDouble(employeeDoc, "revenue")
        val employeeId = MongoWriter.safeGetString(employeeDoc, "employeeId")
        
        if (sector != null) {
          val current = sectorStats.getOrElse(sector, (0L, 0.0, 0L))
          val employeesSet = sectorEmployees.getOrElseUpdate(sector, scala.collection.mutable.Set[String]())
          val newTotalSales = current._1 + salesCount
          val newTotalRevenue = current._2 + revenue
          
          if (employeeId != null) {
            employeesSet.add(employeeId)
          }
          
          sectorStats(sector) = (newTotalSales, newTotalRevenue, employeesSet.size.toLong)
          employeeCount += 1
        }
      }
      
      println(s"[Query6] Processed $employeeCount employees from spark_company_employees")
      println(s"[Query6] Found ${sectorStats.size} sectors: ${sectorStats.keys.mkString(", ")}")
      
      if (sectorStats.nonEmpty) {
        val bulkOps = new util.ArrayList[com.mongodb.client.model.WriteModel[Document]]()
        var savedCount = 0
        
        sectorStats.foreach { case (sector, (totalSales, totalRevenue, totalEmployees)) =>
          val avgSaleAmount = if (totalSales > 0) totalRevenue / totalSales else 0.0
          val filter = new Document("sector", sector)
          
          val doc = new Document()
          doc.append("sector", sector)
          doc.append("totalSales", totalSales)
          doc.append("avgSaleAmount", avgSaleAmount)
          doc.append("totalEmployees", totalEmployees)
          doc.append("updatedAt", new java.util.Date())
          
          bulkOps.add(new com.mongodb.client.model.ReplaceOneModel(filter, doc, new ReplaceOptions().upsert(true)))
          savedCount += 1
          println(s"[Query6] Sector: $sector - TotalSales: $totalSales, AvgSaleAmount: $avgSaleAmount, TotalEmployees: $totalEmployees")
        }
        
        MongoWriter.bulkWrite(marketEmployeeCollection, bulkOps)
        mongoClient.close()
        if (savedCount > 0) {
          println(s"[Query6] SUCCESS: Saved $savedCount Market Employee Performance records to MongoDB")
        } else {
          println(s"[Query6] WARNING: No data to save - sectorStats is empty")
        }
      } else {
        mongoClient.close()
        println(s"[Query6] WARNING: No data found in spark_company_employees collection (count: $collectionCount, employees: $employeeCount)")
      }
    } catch {
      case e: Exception =>
        println(s"[Query6] ERROR: Failed to save Market Employee Performance to MongoDB: ${e.getMessage}")
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
      .option("checkpointLocation", "file:///tmp/spark-checkpoints/market-employee-performance")
      .foreachBatch { (batchDF: DataFrame, batchId: Long) =>
        writeToMongo(batchDF, batchId, mongoUri)
      }
      .trigger(Trigger.ProcessingTime("1 minute"))
      .start()
  }
}

