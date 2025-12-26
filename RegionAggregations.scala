package com.bigdata.sales.queries

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.streaming.{StreamingQuery, Trigger}
import com.mongodb.client.model.{ReplaceOptions, BulkWriteOptions}
import org.bson.Document
import java.util
import com.bigdata.sales.utils.MongoWriter
import com.bigdata.sales.CountMinSketch

object RegionAggregations {
  
  def createAggregation(completedSales: DataFrame): DataFrame = {
    completedSales
      .withWatermark("saleTime", "1 minute")
      .groupBy(
        window(col("saleTime"), "30 seconds"),
        col("region"),
        col("sector")
      )
      .agg(
        sum("totalAmount").alias("revenue"),
        count("*").alias("salesCount")
      )
  }
  
  def writeToMongo(batchDF: DataFrame, batchId: Long, mongoUri: String, citySketch: CountMinSketch): Unit = {
    if (!batchDF.isEmpty) {
      println(s"\n[Query2] Sales by Region - Batch $batchId")
      
      val aggregatedDF = batchDF
        .select(
          col("region"),
          col("sector"),
          col("revenue"),
          col("salesCount")
        )
        .filter(col("region").isNotNull && col("sector").isNotNull)
        .groupBy("region", "sector")
        .agg(
          sum("revenue").alias("revenue"),
          sum("salesCount").alias("salesCount")
        )
      
      aggregatedDF.show(10, false)
      
      try {
        val mongoClient = MongoWriter.createMongoClient(mongoUri)
        val database = mongoClient.getDatabase("bigdata")
        val collection = database.getCollection("spark_sales_by_region")
        
        val rows = aggregatedDF.collect()
        val bulkOps = new util.ArrayList[com.mongodb.client.model.WriteModel[Document]]()
        
        rows.foreach { row =>
          val region = if (row.isNullAt(row.fieldIndex("region"))) null else row.getAs[String]("region")
          val sector = if (row.isNullAt(row.fieldIndex("sector"))) null else row.getAs[String]("sector")
          
          val filter = new Document("region", region).append("sector", sector)
          val existingDoc = collection.find(filter).first()
          
          val newRevenue = if (row.isNullAt(row.fieldIndex("revenue"))) 0.0 else row.getAs[Double]("revenue")
          val newSalesCount = if (row.isNullAt(row.fieldIndex("salesCount"))) 0L else row.getAs[Long]("salesCount")
          
          val finalRevenue = if (existingDoc != null && existingDoc.containsKey("revenue")) {
            MongoWriter.safeGetDouble(existingDoc, "revenue") + newRevenue
          } else {
            newRevenue
          }
          
          val finalSalesCount = if (existingDoc != null && existingDoc.containsKey("salesCount")) {
            MongoWriter.safeGetLong(existingDoc, "salesCount") + newSalesCount
          } else {
            newSalesCount
          }
          
          val doc = new Document()
          doc.append("region", region)
          doc.append("sector", sector)
          doc.append("revenue", finalRevenue)
          doc.append("salesCount", finalSalesCount)
          doc.append("updatedAt", new java.util.Date())
          
          bulkOps.add(new com.mongodb.client.model.ReplaceOneModel(filter, doc, new ReplaceOptions().upsert(true)))
          
          if (region != null) {
            citySketch.increment(region)
          }
        }
        
        MongoWriter.bulkWrite(collection, bulkOps)
        val savedCount = rows.length
        mongoClient.close()
        println(s"[Query2] SUCCESS: Saved $savedCount Sales by Region records to MongoDB")
      } catch {
        case e: Exception =>
          println(s"[Query2] ERROR: Failed to save Sales by Region to MongoDB: ${e.getMessage}")
          e.printStackTrace()
      }
    }
  }
  
  def createQuery(regionAggregations: DataFrame, mongoUri: String, citySketch: CountMinSketch): StreamingQuery = {
    regionAggregations
      .writeStream
      .outputMode("update")
      .option("checkpointLocation", "file:///tmp/spark-checkpoints/region-aggregations")
      .foreachBatch { (batchDF: DataFrame, batchId: Long) =>
        writeToMongo(batchDF, batchId, mongoUri, citySketch)
      }
      .trigger(Trigger.ProcessingTime("10 seconds"))
      .start()
  }
}

