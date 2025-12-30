package com.bigdata.sales.queries

import org.apache.spark.sql.{DataFrame, SparkSession}
import org.apache.spark.sql.functions._
import org.apache.spark.sql.streaming.{StreamingQuery, Trigger}
import com.mongodb.client.model.{ReplaceOptions, BulkWriteOptions}
import org.bson.Document
import org.bson.types.ObjectId
import java.util
import com.bigdata.sales.utils.MongoWriter

object CompanyTopProducts {
  
  def createAggregation(enrichedSaleItems: DataFrame): DataFrame = {
    enrichedSaleItems
      .withWatermark("saleTime", "2 minutes")
      .groupBy(
        window(col("saleTime"), "1 minute"),
        col("productId"),
        col("companyId"),
        col("sector")
      )
      .agg(
        sum("subtotal").alias("totalRevenue"),
        sum("quantity").alias("totalQuantity"),
        first(when(col("productName").isNotNull, col("productName")).otherwise(lit(null))).alias("productName"),
        first(when(col("brand").isNotNull, col("brand")).otherwise(lit(null))).alias("brand"),
        avg("price").alias("avgPrice")
      )
      .filter(col("productId").isNotNull && col("companyId").isNotNull && col("sector").isNotNull)
  }
  
  def writeToMongo(batchDF: DataFrame, batchId: Long, mongoUri: String): Unit = {
    if (!batchDF.isEmpty) {
      println(s"\n[Query4] Company Top Products - Batch $batchId")
      
      val aggregatedDF = batchDF
        .select(
          col("productId"),
          col("companyId"),
          col("sector"),
          col("productName"),
          col("brand"),
          col("totalRevenue"),
          col("totalQuantity"),
          col("avgPrice")
        )
        .filter(col("productId").isNotNull && col("companyId").isNotNull && col("sector").isNotNull)
        .groupBy("productId", "companyId", "sector")
        .agg(
          sum("totalRevenue").alias("totalRevenue"),
          sum("totalQuantity").alias("totalQuantity"),
          first(when(col("productName").isNotNull, col("productName")).otherwise(lit(null))).alias("productName"),
          first(when(col("brand").isNotNull, col("brand")).otherwise(lit(null))).alias("brand"),
          (sum(col("totalRevenue")) / sum(col("totalQuantity"))).alias("avgPrice")
        )
      
      aggregatedDF.show(10, false)
      
      try {
        val mongoClient = MongoWriter.createMongoClient(mongoUri)
        val database = mongoClient.getDatabase("bigdata")
        val collection = database.getCollection("spark_company_top_products")
        val productsCollection = database.getCollection("products")
        
        val rows = aggregatedDF.collect()
        var savedCount = 0
        val savedCompanies = scala.collection.mutable.Set[String]()
        val bulkOps = new util.ArrayList[com.mongodb.client.model.WriteModel[Document]]()
        
        rows.foreach { row =>
          val productId = if (row.isNullAt(row.fieldIndex("productId"))) null else row.getAs[String]("productId")
          val companyId = if (row.isNullAt(row.fieldIndex("companyId"))) null else row.getAs[String]("companyId")
          val sector = if (row.isNullAt(row.fieldIndex("sector"))) null else row.getAs[String]("sector")
          
          if (productId != null && companyId != null && sector != null) {
            val filter = new Document("companyId", companyId)
              .append("sector", sector)
              .append("productId", productId)
            val existingDoc = collection.find(filter).first()
            
            val newTotalRevenue = if (row.isNullAt(row.fieldIndex("totalRevenue"))) 0.0 else row.getAs[Double]("totalRevenue")
            val newTotalQuantity = if (row.isNullAt(row.fieldIndex("totalQuantity"))) 0L else row.getAs[Long]("totalQuantity")
            val newAvgPrice = if (row.isNullAt(row.fieldIndex("avgPrice"))) 0.0 else {
              val price = row.getAs[Any]("avgPrice")
              price match {
                case d: java.lang.Double => d.doubleValue()
                case d: Double => d
                case _ => 0.0
              }
            }
            
            var productName = if (existingDoc != null && existingDoc.containsKey("productName") && existingDoc.get("productName") != null) {
              existingDoc.getString("productName")
            } else if (!row.isNullAt(row.fieldIndex("productName"))) {
              row.getAs[String]("productName")
            } else {
              null
            }
            
            var brand = if (existingDoc != null && existingDoc.containsKey("brand") && existingDoc.get("brand") != null) {
              existingDoc.getString("brand")
            } else if (!row.isNullAt(row.fieldIndex("brand"))) {
              row.getAs[String]("brand")
            } else {
              null
            }
            
            if (productName == null && productId != null) {
              try {
                val productFilter = new Document("_id", new ObjectId(productId))
                val productDoc = productsCollection.find(productFilter).first()
                if (productDoc != null) {
                  if (productName == null && productDoc.containsKey("productName")) {
                    productName = productDoc.getString("productName")
                  }
                  if (brand == null && productDoc.containsKey("brand")) {
                    brand = productDoc.getString("brand")
                  }
                }
              } catch {
                case _: Exception =>
                  try {
                    val productFilter = new Document("_id", productId)
                    val productDoc = productsCollection.find(productFilter).first()
                    if (productDoc != null) {
                      if (productName == null && productDoc.containsKey("productName")) {
                        productName = productDoc.getString("productName")
                      }
                      if (brand == null && productDoc.containsKey("brand")) {
                        brand = productDoc.getString("brand")
                      }
                    }
                  } catch {
                    case _: Exception =>
                  }
              }
            }
            
            val finalTotalRevenue = if (existingDoc != null && existingDoc.containsKey("totalRevenue")) {
              MongoWriter.safeGetDouble(existingDoc, "totalRevenue") + newTotalRevenue
            } else {
              newTotalRevenue
            }
            
            val finalTotalQuantity = if (existingDoc != null && existingDoc.containsKey("totalQuantity")) {
              MongoWriter.safeGetLong(existingDoc, "totalQuantity") + newTotalQuantity
            } else {
              newTotalQuantity
            }
            
            val finalAvgPrice = if (existingDoc != null && existingDoc.containsKey("avgPrice") && existingDoc.containsKey("totalQuantity")) {
              val existingAvg = MongoWriter.safeGetDouble(existingDoc, "avgPrice")
              val existingQty = MongoWriter.safeGetLong(existingDoc, "totalQuantity")
              val totalQty = existingQty + newTotalQuantity
              if (totalQty > 0) {
                ((existingAvg * existingQty) + (newAvgPrice * newTotalQuantity)) / totalQty
              } else {
                newAvgPrice
              }
            } else {
              newAvgPrice
            }
            
            val doc = new Document()
            doc.append("companyId", companyId)
            doc.append("sector", sector)
            doc.append("productId", productId)
            if (productName != null) doc.append("productName", productName)
            if (brand != null) doc.append("brand", brand)
            doc.append("totalRevenue", finalTotalRevenue)
            doc.append("totalQuantity", finalTotalQuantity)
            doc.append("avgPrice", finalAvgPrice)
            doc.append("updatedAt", new java.util.Date())
            
            bulkOps.add(new com.mongodb.client.model.ReplaceOneModel(filter, doc, new ReplaceOptions().upsert(true)))
            savedCount += 1
            if (companyId != null) savedCompanies.add(companyId)
          }
        }
        
        MongoWriter.bulkWrite(collection, bulkOps)
        mongoClient.close()
        println(s"[Query4] SUCCESS: Saved $savedCount Company Top Products to MongoDB (companies: ${savedCompanies.size})")
      } catch {
        case e: Exception =>
          println(s"[Query4] ERROR: Failed to save Company Top Products to MongoDB: ${e.getMessage}")
          e.printStackTrace()
      }
    }
  }
  
  def createQuery(companyTopProducts: DataFrame, mongoUri: String): StreamingQuery = {
    companyTopProducts
      .writeStream
      .outputMode("update")
      .option("checkpointLocation", "file:///tmp/spark-checkpoints/company-top-products")
      .foreachBatch { (batchDF: DataFrame, batchId: Long) =>
        writeToMongo(batchDF, batchId, mongoUri)
      }
      .trigger(Trigger.ProcessingTime("1 minute"))
      .start()
  }
}

