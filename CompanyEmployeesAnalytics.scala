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
import org.bson.types.ObjectId
import java.util
import com.bigdata.sales.utils.MongoWriter

object CompanyEmployeesAnalytics {
  
  def createAggregation(completedSales: DataFrame, employeesDF: DataFrame, employeesCount: Long): DataFrame = {
    if (employeesCount > 0) {
      completedSales
        .join(
          employeesDF,
          completedSales("employeeId") === employeesDF("employeeId"),
          "left"
        )
        .withWatermark("saleTime", "2 minutes")
        .groupBy(
          window(col("saleTime"), "1 minute"),
          col("companyId"),
          col("sector"),
          col("employeeId")
        )
        .agg(
          first(when(col("employeeName").isNotNull, col("employeeName")).otherwise(lit(null))).alias("employeeName"),
          sum("totalAmount").alias("revenue"),
          count("*").alias("salesCount"),
          avg("totalAmount").alias("avgSaleAmount")
        )
        .filter(col("employeeId").isNotNull)
    } else {
      completedSales
        .withWatermark("saleTime", "2 minutes")
        .groupBy(
          window(col("saleTime"), "1 minute"),
          col("companyId"),
          col("sector"),
          col("employeeId")
        )
        .agg(
          lit(null).cast("string").alias("employeeName"),
          sum("totalAmount").alias("revenue"),
          count("*").alias("salesCount"),
          avg("totalAmount").alias("avgSaleAmount")
        )
        .filter(col("employeeId").isNotNull)
    }
  }
  
  def writeToMongo(batchDF: DataFrame, batchId: Long, mongoUri: String): Unit = {
    val rowCount = batchDF.count()
    println(s"\n[Query10] Company Employees Analytics - Batch $batchId - Rows: $rowCount")
    
    if (!batchDF.isEmpty) {
      val aggregatedDF = batchDF
        .groupBy("companyId", "employeeId")
        .agg(
          first("sector").alias("sector"),
          first("employeeName").alias("employeeName"),
          sum("revenue").alias("revenue"),
          sum("salesCount").alias("salesCount"),
          avg("avgSaleAmount").alias("avgSaleAmount")
        )
        .filter(col("companyId").isNotNull && col("employeeId").isNotNull)
        .orderBy(desc("revenue"))
      
      val resultDF = aggregatedDF
        .select(
          col("companyId"),
          col("employeeId"),
          col("sector"),
          col("employeeName"),
          col("revenue"),
          col("salesCount"),
          col("avgSaleAmount"),
          current_timestamp().alias("updatedAt"),
          lit(s"batch_$batchId").alias("window")
        )
      
      resultDF.show(20, false)
      
      try {
        val mongoClient = MongoWriter.createMongoClient(mongoUri)
        val database = mongoClient.getDatabase("bigdata")
        val collection = database.getCollection("spark_company_employees")
        val employeesCollection = database.getCollection("employees")
        
        val rows = resultDF.collect()
        val bulkOps = new util.ArrayList[com.mongodb.client.model.WriteModel[Document]]()
        var savedCount = 0
        
        rows.foreach { row =>
          val companyId = if (row.isNullAt(row.fieldIndex("companyId"))) null else row.getAs[String]("companyId")
          val employeeId = if (row.isNullAt(row.fieldIndex("employeeId"))) null else row.getAs[String]("employeeId")
          
          val filter = new Document("companyId", companyId).append("employeeId", employeeId)
          val existingDoc = collection.find(filter).first()
          
          var sector: String = null
          if (!row.isNullAt(row.fieldIndex("sector"))) {
            val sectorValue = row.getAs[String]("sector")
            if (sectorValue != null && sectorValue.trim.nonEmpty) {
              sector = sectorValue.trim
            }
          }
          if (sector == null && existingDoc != null && existingDoc.containsKey("sector")) {
            val sectorValue = existingDoc.getString("sector")
            if (sectorValue != null && sectorValue.trim.nonEmpty) {
              sector = sectorValue.trim
            }
          }
          
          var employeeName: String = null
          if (!row.isNullAt(row.fieldIndex("employeeName"))) {
            val name = row.getAs[String]("employeeName")
            if (name != null && name.trim.nonEmpty) {
              employeeName = name.trim
            }
          }
          if (employeeName == null && existingDoc != null && existingDoc.containsKey("employeeName")) {
            val name = existingDoc.getString("employeeName")
            if (name != null && name.trim.nonEmpty) {
              employeeName = name.trim
            }
          }
          if (employeeName == null && employeeId != null && companyId != null) {
            try {
              val employeeFilter1 = new Document("_id", new ObjectId(employeeId)).append("companyId", companyId)
              val employeeDoc1 = employeesCollection.find(employeeFilter1).first()
              if (employeeDoc1 != null && employeeDoc1.containsKey("employeeName")) {
                val name = employeeDoc1.getString("employeeName")
                if (name != null && name.trim.nonEmpty) {
                  employeeName = name.trim
                }
              }
            } catch {
              case _: Exception =>
                try {
                  val employeeFilter2 = new Document("_id", employeeId).append("companyId", companyId)
                  val employeeDoc2 = employeesCollection.find(employeeFilter2).first()
                  if (employeeDoc2 != null && employeeDoc2.containsKey("employeeName")) {
                    val name = employeeDoc2.getString("employeeName")
                    if (name != null && name.trim.nonEmpty) {
                      employeeName = name.trim
                    }
                  }
                } catch {
                  case _: Exception =>
                    try {
                      val employeeFilter3 = new Document("_id", employeeId)
                      val employeeDoc3 = employeesCollection.find(employeeFilter3).first()
                      if (employeeDoc3 != null && employeeDoc3.containsKey("employeeName")) {
                        val name = employeeDoc3.getString("employeeName")
                        if (name != null && name.trim.nonEmpty) {
                          employeeName = name.trim
                        }
                      }
                    } catch {
                      case _: Exception =>
                    }
                }
            }
          }
          
          if (employeeName == null || employeeName.trim.isEmpty) {
            employeeName = if (employeeId != null && employeeId.length >= 4) {
              s"Employee ${employeeId.substring(employeeId.length - 4)}"
            } else {
              "Unknown Employee"
            }
          }
          
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
          doc.append("employeeId", employeeId)
          if (sector != null) {
            doc.append("sector", sector)
          }
          doc.append("employeeName", employeeName)
          doc.append("revenue", finalRevenue)
          doc.append("salesCount", finalSalesCount)
          doc.append("avgSaleAmount", finalAvgSaleAmount)
          doc.append("updatedAt", if (row.isNullAt(row.fieldIndex("updatedAt"))) new java.util.Date() else row.getAs[java.sql.Timestamp]("updatedAt"))
          
          bulkOps.add(new com.mongodb.client.model.ReplaceOneModel(filter, doc, new ReplaceOptions().upsert(true)))
          savedCount += 1
        }
        
        MongoWriter.bulkWrite(collection, bulkOps)
        mongoClient.close()
        println(s"[Query10] SUCCESS: Saved $savedCount Company Employees records to MongoDB")
      } catch {
        case e: Exception =>
          println(s"[Query10] ERROR: Failed to save Company Employees to MongoDB: ${e.getMessage}")
          e.printStackTrace()
      }
    } else {
      println(s"[Query10] WARNING: Batch $batchId is empty (no data to save)")
    }
  }
  
  def createQuery(companyEmployeesAnalytics: DataFrame, mongoUri: String): StreamingQuery = {
    companyEmployeesAnalytics
      .writeStream
      .outputMode("append")
      .option("checkpointLocation", "file:///tmp/spark-checkpoints/company-employees")
      .foreachBatch { (batchDF: DataFrame, batchId: Long) =>
        writeToMongo(batchDF, batchId, mongoUri)
      }
      .trigger(Trigger.ProcessingTime("1 minute"))
      .start()
  }
}

CompanyEmployeesAnalytics.scala
11 KB