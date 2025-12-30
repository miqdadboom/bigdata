package com.bigdata.sales.schemas

import org.apache.spark.sql.types._

object SalesSchemas {
  
  val salesSchema: StructType = StructType(Array(
    StructField("_id", StringType, nullable = true),
    StructField("saleTime", TimestampType, nullable = true),
    StructField("totalAmount", DoubleType, nullable = true),
    StructField("companyId", StringType, nullable = true),
    StructField("branchId", StringType, nullable = true),
    StructField("region", StringType, nullable = true),
    StructField("city", StringType, nullable = true),
    StructField("sector", StringType, nullable = true),
    StructField("saleType", StringType, nullable = true),
    StructField("saleStatus", StringType, nullable = true),
    StructField("employeeId", StringType, nullable = true),
    StructField("clientId", StringType, nullable = true),
    StructField("timestamp", StringType, nullable = true),
    StructField("eventType", StringType, nullable = true)
  ))
  
  val saleItemSchema: StructType = StructType(Array(
    StructField("_id", StringType, nullable = true),
    StructField("saleId", StringType, nullable = true),
    StructField("productId", StringType, nullable = true),
    StructField("quantity", IntegerType, nullable = true),
    StructField("price", DoubleType, nullable = true),
    StructField("subtotal", DoubleType, nullable = true),
    StructField("sector", StringType, nullable = true),
    StructField("companyId", StringType, nullable = true),
    StructField("saleTime", TimestampType, nullable = true),
    StructField("brand", StringType, nullable = true),
    StructField("timestamp", StringType, nullable = true),
    StructField("eventType", StringType, nullable = true)
  ))
}

