Koko
kareemabukharma
Invisible

This is the start of the #kareem channel. 
miqdad_boom — Yesterday at 4:45 PM
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
      .option("checkpointLocation", "file:///tmp/spark-checkpoints/market-top-brands")
      .foreachBatch { (batchDF: DataFrame, batchId: Long) =>
        writeToMongo(batchDF, batchId, mongoUri)
      }
      .trigger(Trigger.ProcessingTime("1 minute"))
      .start()
  }
}

MarketTopBrands.scala
5 KB