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

