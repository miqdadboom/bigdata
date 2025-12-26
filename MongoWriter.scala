package com.bigdata.sales.utils

import com.mongodb.client.MongoClients
import com.mongodb.client.model.{ReplaceOptions, BulkWriteOptions}
import org.bson.Document
import java.util

object MongoWriter {
  
  def createMongoClient(mongoUri: String): com.mongodb.client.MongoClient = {
    MongoClients.create(mongoUri)
  }
  
  def getCollection(client: com.mongodb.client.MongoClient, databaseName: String, collectionName: String) = {
    client.getDatabase(databaseName).getCollection(collectionName)
  }
  
  def bulkWrite(collection: com.mongodb.client.MongoCollection[Document], operations: util.ArrayList[com.mongodb.client.model.WriteModel[Document]]): Unit = {
    if (operations.size() > 0) {
      collection.bulkWrite(operations, new BulkWriteOptions().ordered(false))
    }
  }
  
  def safeGetString(doc: Document, key: String): String = {
    if (doc.containsKey(key) && doc.get(key) != null) {
      doc.getString(key)
    } else {
      null
    }
  }
  
  def safeGetDouble(doc: Document, key: String): Double = {
    if (doc.containsKey(key) && doc.get(key) != null) {
      val value = doc.get(key)
      value match {
        case d: java.lang.Double => d.doubleValue()
        case d: Double => d
        case _ => 0.0
      }
    } else {
      0.0
    }
  }
  
  def safeGetLong(doc: Document, key: String): Long = {
    if (doc.containsKey(key) && doc.get(key) != null) {
      val value = doc.get(key)
      value match {
        case l: java.lang.Long => l.longValue()
        case i: java.lang.Integer => i.intValue().toLong
        case l: Long => l
        case i: Int => i.toLong
        case _ => 0L
      }
    } else {
      0L
    }
  }
}

