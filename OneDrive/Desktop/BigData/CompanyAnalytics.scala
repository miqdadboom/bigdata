package com.bigdata.sales.queries

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.streaming.{StreamingQuery, Trigger}
import com.mongodb.client.model.{ReplaceOptions, BulkWriteOptions}
import org.bson.Document
import java.util
import com.bigdata.sales.utils.MongoWriter

object CompanyAnalytics {
  
  def createAggregation(completedSales: DataFrame): DataFrame = {
    completedSales
      .withWatermark("saleTime", "2 minutes")
      .groupBy(
        window(col("saleTime"), "1 minute"),
        col("companyId"),
        col("sector")
      )
      .agg(
        sum("totalAmount").alias("revenue"),
        count("*").alias("salesCount"),
        avg("totalAmount").alias("avgSaleAmount")
      )
  }
  
  def writeToMongo(batchDF: DataFrame, batchId: Long, mongoUri: String): Unit = {
    val rowCount = batchDF.count()
    val timestamp = new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date())
    println(s"\n[$timestamp] [Query7] Company Analytics - Batch $batchId - Rows: $rowCount")
    
    if (rowCount > 0) {
      val resultDF = batchDF
        .select(
          col("companyId"),
          col("sector"),
          col("revenue"),
          col("salesCount"),
          col("avgSaleAmount"),
          current_timestamp().alias("updatedAt"),
          lit(s"batch_$batchId").alias("window")
        )
        .filter(col("companyId").isNotNull && col("sector").isNotNull)
      
      resultDF.show(10, false)
      
      try {
        val mongoClient = MongoWriter.createMongoClient(mongoUri)
        val database = mongoClient.getDatabase("bigdata")
        val collection = database.getCollection("spark_company_analytics")
        
        val aggregatedDF = resultDF
          .groupBy("companyId", "sector")
          .agg(
            sum("revenue").alias("revenue"),
            sum("salesCount").alias("salesCount"),
            avg("avgSaleAmount").alias("avgSaleAmount"),
            max("updatedAt").alias("updatedAt")
          )
        
        aggregatedDF.show(10, false)
        
        val rows = aggregatedDF.collect()
        val bulkOps = new util.ArrayList[com.mongodb.client.model.WriteModel[Document]]()
        
        rows.foreach { row =>
          val companyId = if (row.isNullAt(row.fieldIndex("companyId"))) null else row.getAs[String]("companyId")
          val sector = if (row.isNullAt(row.fieldIndex("sector"))) null else row.getAs[String]("sector")
          
          val filter = new Document("companyId", companyId).append("sector", sector)
          val existingDoc = collection.find(filter).first()
          
          val newRevenue = if (row.isNullAt(row.fieldIndex("revenue"))) 0.0 else row.getAs[Double]("revenue")
          val newSalesCount = if (row.isNullAt(row.fieldIndex("salesCount"))) 0L else row.getAs[Long]("salesCount")
          val newAvgSaleAmount = if (row.isNullAt(row.fieldIndex("avgSaleAmount"))) 0.0 else row.getAs[Double]("avgSaleAmount")
          
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
          
          val finalAvgSaleAmount = if (existingDoc != null && existingDoc.containsKey("avgSaleAmount") && existingDoc.containsKey("salesCount")) {
            val existingAvg = MongoWriter.safeGetDouble(existingDoc, "avgSaleAmount")
            val existingCount = MongoWriter.safeGetLong(existingDoc, "salesCount")
            val totalCount = existingCount + newSalesCount
            if (totalCount > 0) {
              ((existingAvg * existingCount) + (newAvgSaleAmount * newSalesCount)) / totalCount
            } else {
              newAvgSaleAmount
            }
          } else {
            newAvgSaleAmount
          }
          
          val doc = new Document()
          doc.append("companyId", companyId)
          doc.append("sector", sector)
          doc.append("revenue", finalRevenue)
          doc.append("salesCount", finalSalesCount)
          doc.append("avgSaleAmount", finalAvgSaleAmount)
          doc.append("updatedAt", if (row.isNullAt(row.fieldIndex("updatedAt"))) new java.util.Date() else row.getAs[java.sql.Timestamp]("updatedAt"))
          
          bulkOps.add(new com.mongodb.client.model.ReplaceOneModel(filter, doc, new ReplaceOptions().upsert(true)))
        }
        
        MongoWriter.bulkWrite(collection, bulkOps)
        val savedCount = rows.length
        mongoClient.close()
        println(s"[Query7] SUCCESS: Saved $savedCount Company Analytics records to MongoDB")
      } catch {
        case e: Exception =>
          println(s"[Query7] ERROR: Failed to save Company Analytics to MongoDB: ${e.getMessage}")
          e.printStackTrace()
      }
    } else {
      println(s"[Query7] WARNING: Batch $batchId is empty (no data to save)")
    }
  }
  
  def createQuery(companyAnalytics: DataFrame, mongoUri: String): StreamingQuery = {
    companyAnalytics
      .writeStream
      .outputMode("append")
      .option("checkpointLocation", "file:///tmp/spark-checkpoints/company-analytics")
      .foreachBatch { (batchDF: DataFrame, batchId: Long) =>
        writeToMongo(batchDF, batchId, mongoUri)
      }
      .trigger(Trigger.ProcessingTime("10 seconds"))
      .start()
  }
}

