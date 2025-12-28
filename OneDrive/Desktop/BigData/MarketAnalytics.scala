package com.bigdata.sales.queries

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.streaming.{StreamingQuery, Trigger}
import com.mongodb.client.model.{ReplaceOptions, BulkWriteOptions}
import org.bson.Document
import java.util
import com.bigdata.sales.utils.MongoWriter

object MarketAnalytics {
  
  def createAggregation(completedSales: DataFrame): DataFrame = {
    completedSales
      .withWatermark("saleTime", "1 minute")
      .groupBy(
        window(col("saleTime"), "1 minute"),
        col("sector")
      )
      .agg(
        sum("totalAmount").alias("marketRevenue"),
        count("*").alias("marketSalesCount"),
        avg("totalAmount").alias("marketAvgSale"),
        collect_set("companyId").alias("companyIds")
      )
  }
  
  def writeToMongo(batchDF: DataFrame, batchId: Long, mongoUri: String): Unit = {
    val timestamp = new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date())
    println(s"\n[$timestamp] [Query8] Market Analytics - Batch $batchId")
    println(s"[Query8] Reading from spark_company_analytics collection...")
    
    try {
      val mongoClient = MongoWriter.createMongoClient(mongoUri)
      val database = mongoClient.getDatabase("bigdata")
      val companyAnalyticsCollection = database.getCollection("spark_company_analytics")
      val marketAnalyticsCollection = database.getCollection("spark_market_analytics")
      
      val allCompanies = companyAnalyticsCollection.find().iterator()
      val sectorStats = scala.collection.mutable.Map[String, (Double, Long, scala.collection.mutable.Set[String])]()
      var companyCount = 0
      
      while (allCompanies.hasNext) {
        val companyDoc = allCompanies.next()
        val sector = MongoWriter.safeGetString(companyDoc, "sector")
        val revenue = MongoWriter.safeGetDouble(companyDoc, "revenue")
        val salesCount = MongoWriter.safeGetLong(companyDoc, "salesCount")
        val companyId = MongoWriter.safeGetString(companyDoc, "companyId")
        
        if (sector != null) {
          val current = sectorStats.getOrElse(sector, (0.0, 0L, scala.collection.mutable.Set[String]()))
          val companiesSet = current._3
          val newTotalRevenue = current._1 + revenue
          val newTotalSalesCount = current._2 + salesCount
          
          if (companyId != null) {
            companiesSet.add(companyId)
          }
          
          sectorStats(sector) = (newTotalRevenue, newTotalSalesCount, companiesSet)
          companyCount += 1
        }
      }
      
      println(s"[Query8] Processed $companyCount companies from spark_company_analytics")
      println(s"[Query8] Found ${sectorStats.size} sectors: ${sectorStats.keys.mkString(", ")}")
      
      if (sectorStats.nonEmpty) {
        val bulkOps = new util.ArrayList[com.mongodb.client.model.WriteModel[Document]]()
        var savedCount = 0
        
        sectorStats.foreach { case (sector, (totalRevenue, totalSalesCount, companiesSet)) =>
          val marketAvgSale = if (totalSalesCount > 0) totalRevenue / totalSalesCount else 0.0
          val totalCompanies = companiesSet.size.toLong
          val filter = new Document("sector", sector)
          
          val doc = new Document()
          doc.append("sector", sector)
          doc.append("marketRevenue", totalRevenue)
          doc.append("marketSalesCount", totalSalesCount)
          doc.append("marketAvgSale", marketAvgSale)
          doc.append("totalCompanies", totalCompanies)
          doc.append("updatedAt", new java.util.Date())
          
          bulkOps.add(new com.mongodb.client.model.ReplaceOneModel(filter, doc, new ReplaceOptions().upsert(true)))
          savedCount += 1
          println(s"[Query8] Sector: $sector - MarketRevenue: $totalRevenue, MarketSalesCount: $totalSalesCount, MarketAvgSale: $marketAvgSale, TotalCompanies: $totalCompanies")
        }
        
        MongoWriter.bulkWrite(marketAnalyticsCollection, bulkOps)
        mongoClient.close()
        println(s"[Query8] SUCCESS: Saved $savedCount Market Analytics records to MongoDB")
      } else {
        mongoClient.close()
        println(s"[Query8] WARNING: No data found in spark_company_analytics collection")
      }
    } catch {
      case e: Exception =>
        println(s"[Query8] ERROR: Failed to save Market Analytics to MongoDB: ${e.getMessage}")
        e.printStackTrace()
    }
  }
  
  def createQuery(marketAnalytics: DataFrame, mongoUri: String): StreamingQuery = {
    marketAnalytics
      .writeStream
      .outputMode("append")
      .option("checkpointLocation", "file:///tmp/spark-checkpoints/market-analytics")
      .foreachBatch { (batchDF: DataFrame, batchId: Long) =>
        writeToMongo(batchDF, batchId, mongoUri)
      }
      .trigger(Trigger.ProcessingTime("10 seconds"))
      .start()
  }
}

