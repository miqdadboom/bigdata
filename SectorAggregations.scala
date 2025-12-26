package com.bigdata.sales.queries

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.streaming.{StreamingQuery, Trigger}
import com.mongodb.client.model.{ReplaceOptions, BulkWriteOptions}
import org.bson.Document
import java.util
import com.bigdata.sales.utils.MongoWriter
import com.bigdata.sales.CountMinSketch

object SectorAggregations {
  
  def createAggregation(completedSales: DataFrame): DataFrame = {
    completedSales
      .withWatermark("saleTime", "1 minute")
      .groupBy(
        window(col("saleTime"), "30 seconds"),
        col("sector")
      )
      .agg(
        sum("totalAmount").alias("revenue"),
        count("*").alias("salesCount"),
        avg("totalAmount").alias("avgSaleAmount")
      )
  }
  
  def writeToMongo(batchDF: DataFrame, batchId: Long, mongoUri: String, productSketch: CountMinSketch): Unit = {
    println(s"\n[Query1] Sales by Sector - Batch $batchId")
    println(s"[Query1] Reading from spark_market_analytics collection...")
    
    try {
      val mongoClient = MongoWriter.createMongoClient(mongoUri)
      val database = mongoClient.getDatabase("bigdata")
      val marketAnalyticsCollection = database.getCollection("spark_market_analytics")
      val salesBySectorCollection = database.getCollection("spark_sales_by_sector")
      
      val allSectors = marketAnalyticsCollection.find().iterator()
      val bulkOps = new util.ArrayList[com.mongodb.client.model.WriteModel[Document]]()
      var savedCount = 0
      
      while (allSectors.hasNext) {
        val sectorDoc = allSectors.next()
        val sector = MongoWriter.safeGetString(sectorDoc, "sector")
        
        if (sector != null) {
          val marketRevenue = MongoWriter.safeGetDouble(sectorDoc, "marketRevenue")
          val marketSalesCount = MongoWriter.safeGetLong(sectorDoc, "marketSalesCount")
          val marketAvgSale = MongoWriter.safeGetDouble(sectorDoc, "marketAvgSale")
          
          val filter = new Document("sector", sector)
          val doc = new Document()
          doc.append("sector", sector)
          doc.append("revenue", marketRevenue)
          doc.append("salesCount", marketSalesCount)
          doc.append("avgSaleAmount", marketAvgSale)
          doc.append("updatedAt", new java.util.Date())
          
          bulkOps.add(new com.mongodb.client.model.ReplaceOneModel(filter, doc, new ReplaceOptions().upsert(true)))
          savedCount += 1
          
          productSketch.increment(sector)
          println(s"[Query1] Sector: $sector | Revenue: $marketRevenue | SalesCount: $marketSalesCount | AvgSaleAmount: $marketAvgSale")
        }
      }
      
      MongoWriter.bulkWrite(salesBySectorCollection, bulkOps)
      mongoClient.close()
      println(s"[Query1] SUCCESS: Saved $savedCount Sales by Sector records to MongoDB")
    } catch {
      case e: Exception =>
        println(s"[Query1] ERROR: Failed to save Sales by Sector to MongoDB: ${e.getMessage}")
        e.printStackTrace()
    }
  }
  
  def createQuery(sectorAggregations: DataFrame, mongoUri: String, productSketch: CountMinSketch): StreamingQuery = {
    sectorAggregations
      .writeStream
      .outputMode("update")
      .option("checkpointLocation", "file:///tmp/spark-checkpoints/sector-aggregations")
      .foreachBatch { (batchDF: DataFrame, batchId: Long) =>
        writeToMongo(batchDF, batchId, mongoUri, productSketch)
      }
      .trigger(Trigger.ProcessingTime("10 seconds"))
      .start()
  }
}

