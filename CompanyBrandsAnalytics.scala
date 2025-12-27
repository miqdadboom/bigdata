package com.bigdata.sales.queries

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.streaming.{StreamingQuery, Trigger}
import com.mongodb.client.model.{ReplaceOptions, BulkWriteOptions}
import org.bson.Document
import java.util
import com.bigdata.sales.utils.MongoWriter

object MarketTopBrands {
  
  def createAggregation(enrichedSaleItems: DataFrame): DataFrame = {
    enrichedSaleItems
      .withWatermark("saleTime", "2 minutes")
      .filter(col("brand").isNotNull && col("brand") =!= "")
      .groupBy(
        window(col("saleTime"), "1 minute"),
        col("brand"),
        col("sector")
      )
      .agg(
        sum("subtotal").alias("totalRevenue"),
        approx_count_distinct("productId").alias("productCount")
      )
  }
  
  def writeToMongo(batchDF: DataFrame, batchId: Long, mongoUri: String): Unit = {
    println(s"\n[Query5] Market Top Brands - Batch $batchId")
    println(s"[Query5] Reading from spark_company_brands collection...")
    
    try {
      val mongoClient = MongoWriter.createMongoClient(mongoUri)
      val database = mongoClient.getDatabase("bigdata")
      val companyBrandsCollection = database.getCollection("spark_company_brands")
      val marketBrandsCollection = database.getCollection("spark_market_analytics_top_brands")
      
      val allBrands = companyBrandsCollection.find().iterator()
      val brandStats = scala.collection.mutable.Map[(String, String), (Double, Long)]()
      var brandCount = 0
      
      while (allBrands.hasNext) {
        val brandDoc = allBrands.next()
        val sector = MongoWriter.safeGetString(brandDoc, "sector")
        val brand = MongoWriter.safeGetString(brandDoc, "brand")
        val revenue = MongoWriter.safeGetDouble(brandDoc, "revenue")
        val quantity = MongoWriter.safeGetLong(brandDoc, "quantity")
        
        if (sector != null && brand != null) {
          val key = (sector, brand)
          val current = brandStats.getOrElse(key, (0.0, 0L))
          val newTotalRevenue = current._1 + revenue
          val newMaxQuantity = Math.max(current._2, quantity)
          brandStats(key) = (newTotalRevenue, newMaxQuantity)
          brandCount += 1
        }
      }
      
      println(s"[Query5] Processed $brandCount brands from spark_company_brands")
      println(s"[Query5] Found ${brandStats.size} unique sector+brand combinations")
      
      if (brandStats.nonEmpty) {
        val bulkOps = new util.ArrayList[com.mongodb.client.model.WriteModel[Document]]()
        var savedCount = 0
        val savedSectors = scala.collection.mutable.Set[String]()
        
        brandStats.foreach { case ((sector, brand), (totalRevenue, maxQuantity)) =>
          val filter = new Document("sector", sector).append("brand", brand)
          val productCount = maxQuantity
          val doc = new Document()
          doc.append("brand", brand)
          doc.append("sector", sector)
          doc.append("totalRevenue", totalRevenue)
          doc.append("productCount", productCount)
          doc.append("updatedAt", new java.util.Date())
          
          bulkOps.add(new com.mongodb.client.model.ReplaceOneModel(filter, doc, new ReplaceOptions().upsert(true)))
          savedCount += 1
          if (sector != null) savedSectors.add(sector)
          println(s"[Query5] Sector: $sector, Brand: $brand - TotalRevenue: $totalRevenue, ProductCount: $productCount")
        }
        
        MongoWriter.bulkWrite(marketBrandsCollection, bulkOps)
        mongoClient.close()
        println(s"[Query5] SUCCESS: Saved $savedCount Market Top Brands to MongoDB (sectors: ${savedSectors.mkString(", ")})")
      } else {
        mongoClient.close()
        println(s"[Query5] WARNING: No data found in spark_company_brands collection")
      }
    } catch {
      case e: Exception =>
        println(s"[Query5] ERROR: Failed to save Market Top Brands to MongoDB: ${e.getMessage}")
        e.printStackTrace()
    }
  }
  
  def createQuery(marketTopBrands: DataFrame, mongoUri: String): StreamingQuery = {
    marketTopBrands
      .writeStream
      .outputMode("update")
... (10 lines left)
Collapse
MarketTopBrands.scala
5 KB
package com.bigdata.sales.queries

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.streaming.{StreamingQuery, Trigger}
import com.mongodb.client.model.{ReplaceOptions, BulkWriteOptions}
Expand
MarketEmployeePerformance.scala
6 KB
package com.bigdata.sales.queries

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.expressions.Window
import org.apache.spark.sql.streaming.{StreamingQuery, Trigger}
Expand
CompanyBrandsAnalytics.scala
10 KB
package com.bigdata.sales.queries

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.streaming.{StreamingQuery, Trigger}
import com.mongodb.client.model.{ReplaceOptions, BulkWriteOptions}
Expand
CompanyEmployeesAnalytics.scala
11 KB
﻿
package com.bigdata.sales.queries

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.expressions.Window
import org.apache.spark.sql.streaming.{StreamingQuery, Trigger}
import com.mongodb.client.model.{ReplaceOptions, BulkWriteOptions}
import org.bson.Document
import java.util
import com.bigdata.sales.utils.MongoWriter

object CompanyBrandsAnalytics {
  
  def createAggregation(saleItemsWithWatermark: DataFrame, completedSalesWithWatermark: DataFrame, productsDF: DataFrame, productsCount: Long): DataFrame = {
    if (productsCount > 0) {
      val joinedDF = saleItemsWithWatermark
        .join(
          completedSalesWithWatermark,
          saleItemsWithWatermark("saleId") === completedSalesWithWatermark("_id"),
          "inner"
        )
        .join(
          productsDF,
          saleItemsWithWatermark("productId") === productsDF("productId"),
          "left"
        )
        .select(
          saleItemsWithWatermark("saleTime").alias("saleTime"),
          completedSalesWithWatermark("companyId").alias("companyId"),
          saleItemsWithWatermark("sector").alias("sector"),
          saleItemsWithWatermark("productId").alias("productId"),
          coalesce(productsDF("productName"), lit(null)).alias("productName"),
          coalesce(productsDF("brand"), saleItemsWithWatermark("brand")).alias("brand"),
          saleItemsWithWatermark("subtotal").alias("subtotal"),
          saleItemsWithWatermark("quantity").alias("quantity"),
          coalesce(productsDF("productPrice"), lit(null)).alias("productPrice")
        )
      
      joinedDF
        .groupBy(
          window(col("saleTime"), "1 minute"),
          col("companyId"),
          col("sector"),
          col("brand")
        )
        .agg(
          sum("subtotal").alias("revenue"),
          sum("quantity").alias("quantity"),
          first(when(col("productName").isNotNull, col("productName")).otherwise(lit(null))).alias("productName"),
          avg(when(col("productPrice").isNotNull, col("productPrice")).otherwise(lit(null))).alias("avgPrice")
        )
        .filter(col("brand").isNotNull && col("brand") =!= "")
    } else {
      val joinedDF = saleItemsWithWatermark
        .join(
          completedSalesWithWatermark,
          saleItemsWithWatermark("saleId") === completedSalesWithWatermark("_id"),
          "inner"
        )
        .select(
          saleItemsWithWatermark("saleTime").alias("saleTime"),
          completedSalesWithWatermark("companyId").alias("companyId"),
          saleItemsWithWatermark("sector").alias("sector"),
          saleItemsWithWatermark("brand").alias("brand"),
          saleItemsWithWatermark("subtotal").alias("subtotal"),
          saleItemsWithWatermark("quantity").alias("quantity")
        )
      
      joinedDF
        .groupBy(
          window(col("saleTime"), "1 minute"),
          col("companyId"),
          col("sector"),
          col("brand")
        )
        .agg(
          sum("subtotal").alias("revenue"),
          sum("quantity").alias("quantity"),
          lit(null).cast("double").alias("avgPrice")
        )
    }
  }
  
  def writeToMongo(batchDF: DataFrame, batchId: Long, mongoUri: String): Unit = {
    val rowCount = batchDF.count()
    println(s"\n[Query9] Company Brands Analytics - Batch $batchId - Rows: $rowCount")
    
    if (rowCount > 0) {
      println(s"[Query9] Sample data before filtering:")
      batchDF.show(5, false)
      
      val aggregatedDF = batchDF
        .select(
          col("companyId"),
          col("sector"),
          col("brand"),
          col("revenue"),
          col("quantity"),
          col("avgPrice")
        )
        .filter(col("companyId").isNotNull && col("sector").isNotNull && col("brand").isNotNull)
        .groupBy("companyId", "sector", "brand")
        .agg(
          sum("revenue").alias("revenue"),
          sum("quantity").alias("quantity"),
          avg("avgPrice").alias("avgPrice")
        )
      
      val windowSpec = Window.partitionBy("companyId", "sector").orderBy(desc("revenue"))
      val resultDF = aggregatedDF
        .withColumn("rank", row_number().over(windowSpec))
        .filter(col("rank") <= 5)
        .withColumn("updatedAt", current_timestamp())
        .withColumn("window", lit(s"batch_$batchId"))
        .select(
          col("companyId"),
          col("sector"),
          col("brand"),
          col("revenue"),
          col("quantity"),
          col("avgPrice"),
          col("updatedAt"),
          col("window")
        )
      
      resultDF.show(10, false)
      
      try {
        val mongoClient = MongoWriter.createMongoClient(mongoUri)
        val database = mongoClient.getDatabase("bigdata")
        val collection = database.getCollection("spark_company_brands")
        
        val rows = resultDF.collect()
        println(s"[Query9] After filtering and limiting: ${rows.length} rows to save")
        if (rows.isEmpty) {
          println("[Query9] WARNING: No rows to save after filtering! Check if data has companyId, sector, and brand.")
        }
        
        var savedCount = 0
        val bulkOps = new util.ArrayList[com.mongodb.client.model.WriteModel[Document]]()
        
        rows.foreach { row =>
          val companyId = if (row.isNullAt(row.fieldIndex("companyId"))) null else row.getAs[String]("companyId")
          val sector = if (row.isNullAt(row.fieldIndex("sector"))) null else row.getAs[String]("sector")
          val brand = if (row.isNullAt(row.fieldIndex("brand"))) null else row.getAs[String]("brand")
          
          val filter = new Document("companyId", companyId).append("sector", sector).append("brand", brand)
          val existingDoc = collection.find(filter).first()
          
          val newRevenue = if (row.isNullAt(row.fieldIndex("revenue"))) 0.0 else row.getAs[Double]("revenue")
          val newQuantity = if (row.isNullAt(row.fieldIndex("quantity"))) 0L else row.getAs[Long]("quantity")
          val newAvgPrice: Option[Double] = if (row.isNullAt(row.fieldIndex("avgPrice"))) {
            None
          } else {
            Some(row.getAs[Double]("avgPrice"))
          }
          
          val finalRevenue = if (existingDoc != null && existingDoc.containsKey("revenue")) {
            MongoWriter.safeGetDouble(existingDoc, "revenue") + newRevenue
          } else {
            newRevenue
          }
          
          val finalQuantity = if (existingDoc != null && existingDoc.containsKey("quantity")) {
            MongoWriter.safeGetLong(existingDoc, "quantity") + newQuantity
          } else {
            newQuantity
          }
          
          val finalAvgPrice: Option[Double] = if (existingDoc != null && existingDoc.containsKey("avgPrice") && existingDoc.get("avgPrice") != null && existingDoc.containsKey("quantity")) {
            val existingAvg = MongoWriter.safeGetDouble(existingDoc, "avgPrice")
            val existingQty = MongoWriter.safeGetLong(existingDoc, "quantity")
            val totalQty = existingQty + newQuantity
            if (totalQty > 0 && newAvgPrice.isDefined) {
              Some(((existingAvg * existingQty) + (newAvgPrice.get * newQuantity)) / totalQty)
            } else if (newAvgPrice.isDefined) {
              newAvgPrice
            } else {
              Some(existingAvg)
            }
          } else {
            newAvgPrice
          }
          
          val doc = new Document()
          doc.append("companyId", companyId)
          doc.append("sector", sector)
          doc.append("brand", brand)
          doc.append("revenue", finalRevenue)
          doc.append("quantity", finalQuantity)
          if (finalAvgPrice.isDefined) {
            doc.append("avgPrice", finalAvgPrice.get)
          }
          doc.append("updatedAt", if (row.isNullAt(row.fieldIndex("updatedAt"))) new java.util.Date() else row.getAs[java.sql.Timestamp]("updatedAt"))
          
          bulkOps.add(new com.mongodb.client.model.ReplaceOneModel(filter, doc, new ReplaceOptions().upsert(true)))
          savedCount += 1
        }
        
        MongoWriter.bulkWrite(collection, bulkOps)
        mongoClient.close()
        println(s"[Query9] SUCCESS: Saved $savedCount Company Brands records to MongoDB")
      } catch {
        case e: Exception =>
          println(s"[Query9] ERROR: Failed to save Company Brands to MongoDB: ${e.getMessage}")
          e.printStackTrace()
      }
    }
  }
  
  def createQuery(companyBrandsAnalytics: DataFrame, mongoUri: String): StreamingQuery = {
    companyBrandsAnalytics
      .writeStream
      .outputMode("append")
      .option("checkpointLocation", "file:///tmp/spark-checkpoints/company-brands")
      .foreachBatch { (batchDF: DataFrame, batchId: Long) =>
        writeToMongo(batchDF, batchId, mongoUri)
      }
      .trigger(Trigger.ProcessingTime("1 minute"))
      .start()
  }
}

CompanyBrandsAnalytics.scala
10 KB