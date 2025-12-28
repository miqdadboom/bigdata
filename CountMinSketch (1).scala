package com.bigdata.sales

import scala.util.hashing.MurmurHash3

/**
 * Count-Min Sketch: Probabilistic data structure for frequency estimation
 * Memory-efficient alternative to exact counting for large datasets
 */
class CountMinSketch(width: Int, depth: Int) {
  private val table = Array.ofDim[Long](depth, width)
  
  // Hash functions
  private def hash(item: String, seed: Int): Int = {
    Math.abs(MurmurHash3.stringHash(item, seed)) % width
  }
  
  def increment(item: String): Unit = {
    for (i <- 0 until depth) {
      val index = hash(item, i)
      table(i)(index) += 1
    }
  }
  
  def getMemoryUsage: Long = {
    width * depth * 8 // 8 bytes per Long
  }
}

object CountMinSketch {
  /**
   * Create a Count-Min Sketch with default parameters
   */
  def createDefault: CountMinSketch = {
    new CountMinSketch(width = 27284, depth = 5)
  }
  
}

