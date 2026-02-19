📊 Big Data Sales Analysis

Real-Time Multi-Company Sales Analytics Platform built using Apache Spark Structured Streaming and Apache Kafka.


🚀 Overview

Big Data Sales Analysis is a real-time analytics system that processes streaming sales data from multiple companies.

The platform enables companies to:

Monitor sales performance in real-time

Compare company performance against market benchmarks

Analyze revenue by sector, region, products, brands, and employees

Visualize insights through interactive dashboards

The system is designed with a complete end-to-end data pipeline from ingestion to visualization.


🏗 Architecture:

Backend API (Node.js)
        ↓
Apache Kafka (Message Broker)
        ↓
Apache Spark Structured Streaming
        ↓
MongoDB (Analytics Storage)
        ↓
React.js Dashboard (Visualization)


⚙️ Tech Stack:

🔥 Big Data & Streaming

Apache Spark (Structured Streaming)

Apache Kafka

Spark SQL

Window-based Aggregations

Watermarking

🖥 Backend

Node.js

Express.js

REST APIs

JWT Authentication

💻 Frontend

React.js

Tailwind CSS

🗄 Database

MongoDB


📊 Key Features:

✅ 10 Real-Time Streaming Queries

Sales by Sector

Sales by Region

Company Analytics

Market Analytics

Top Products (Company & Market)

Top Brands

Employee Performance

✅ Window-based Aggregations
✅ Watermark handling for late data
✅ Real-time dashboard updates (Auto-refresh)
✅ Market benchmarking system
✅ Scalable architecture


🧠 Advanced Concepts:
🔹 Structured Streaming

Micro-batch processing for continuous data streams.

🔹 Watermarking

Controls late-arriving data and prevents memory overflow.

🔹 Window Aggregations

Time-based grouping (e.g., every 10 minutes).

🔹 Probabilistic Data Structure

Implemented Count-Min Sketch for memory-efficient frequency tracking.


📂 Project Structure:
bigdata/
   spark/
      queries/
      schemas/
      utils/
backend/
frontend/

▶️ How to Run
1️⃣ Start Services

MongoDB

Apache Kafka

Backend API

Spark Streaming

Frontend

2️⃣ Generate Sample Data
node backend/scripts/generateRealtimeData.js

3️⃣ Open Dashboard
http://localhost:3000


📈 Example Use Cases:

Real-time business performance monitoring

Market comparison across companies

Sales trend analysis

Employee productivity tracking


🎯 Why This Project?

This project demonstrates:

Distributed systems design

Real-time data processing

End-to-end pipeline engineering

Scalable Big Data architecture

Full-stack integration
