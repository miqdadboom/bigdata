const mongoose = require('mongoose');
const Sale = require('../models/CRUD/Sale');
const SaleItem = require('../models/CRUD/SaleItem');
const Product = require('../models/CRUD/Product');
const Client = require('../models/CRUD/Client');
const Employee = require('../models/CRUD/Employee');
const kafkaProducer = require('../services/kafkaProducer');

// Real-time Sale Ingestion (Single Sale)
exports.ingestSale = async (req, res) => {
  try {
    const saleData = req.body;
    const saleItems = saleData.items || [];
    delete saleData.items;

    // Validate required fields
    if (!saleData.saleTime) {
      saleData.saleTime = new Date();
    }

    // Convert string IDs to ObjectIds if needed
    if (saleData.employeeId && typeof saleData.employeeId === 'string') {
      saleData.employeeId = mongoose.Types.ObjectId.isValid(saleData.employeeId) 
        ? new mongoose.Types.ObjectId(saleData.employeeId) 
        : saleData.employeeId;
    }
    if (saleData.clientId && typeof saleData.clientId === 'string') {
      saleData.clientId = mongoose.Types.ObjectId.isValid(saleData.clientId) 
        ? new mongoose.Types.ObjectId(saleData.clientId) 
        : saleData.clientId;
    }

    // Create sale
    const sale = new Sale(saleData);
    await sale.save();

    // Create sale items
    let items = [];
    if (saleItems.length > 0) {
      // Fetch products to get brand information
      const productIds = saleItems.map(item => item.productId).filter(Boolean);
      const products = productIds.length > 0 
        ? await Product.find({ _id: { $in: productIds } }).lean()
        : [];
      const productMap = new Map(products.map(p => [p._id.toString(), p]));
      
      items = saleItems.map(item => {
        const product = productMap.get(item.productId?.toString());
        return {
          ...item,
          saleId: sale._id,
          // Add brand from product if not already present
          brand: item.brand || product?.brand || null
        };
      });
      await SaleItem.insertMany(items);
    }

    // Calculate total amount
    items = await SaleItem.find({ saleId: sale._id });
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
    sale.totalAmount = totalAmount;
    await sale.save();

    // Send to Kafka for real-time processing
    const saleDoc = sale.toObject();
    saleDoc.items = items;
    await kafkaProducer.sendSale(saleDoc);

    // Send SaleItems to Kafka for Spark processing
    for (const item of items) {
      const itemDoc = item.toObject ? item.toObject() : item;
      // Add sale metadata for Spark joins
      itemDoc.saleId = sale._id.toString();
      itemDoc.sector = sale.sector;
      itemDoc.companyId = sale.companyId;
      itemDoc.saleTime = sale.saleTime;
      await kafkaProducer.sendSaleItem(itemDoc);
    }

    // Return minimal response for real-time performance
    res.status(201).json({
      success: true,
      saleId: sale._id,
      totalAmount: sale.totalAmount,
      timestamp: sale.saleTime
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Batch Sale Ingestion (Multiple Sales)
exports.ingestBatchSales = async (req, res) => {
  try {
    const { sales, source, companyId, branchId } = req.body;
    
    if (!Array.isArray(sales) || sales.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Sales array is required' 
      });
    }

    const results = {
      total: sales.length,
      success: 0,
      failed: 0,
      errors: []
    };

    // Process sales in batches for better performance
    const batchSize = 100;
    for (let i = 0; i < sales.length; i += batchSize) {
      const batch = sales.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (saleData) => {
        try {
          const saleItems = saleData.items || [];
          delete saleData.items;

          // Add source metadata
          if (source) saleData.source = source;
          if (companyId) saleData.companyId = companyId;
          if (branchId) saleData.branchId = branchId;
          if (!saleData.saleTime) {
            saleData.saleTime = new Date();
          }

          const sale = new Sale(saleData);
          await sale.save();

          if (saleItems.length > 0) {
            const items = saleItems.map(item => ({
              ...item,
              saleId: sale._id
            }));
            await SaleItem.insertMany(items);
          }

          // Calculate total
          const items = await SaleItem.find({ saleId: sale._id });
          const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
          sale.totalAmount = totalAmount;
          await sale.save();

          results.success++;
          return { success: true, saleId: sale._id };
        } catch (error) {
          results.failed++;
          results.errors.push({
            index: i + batch.indexOf(saleData),
            error: error.message
          });
          return { success: false, error: error.message };
        }
      });

      await Promise.all(batchPromises);
    }

    res.status(201).json({
      success: true,
      results,
      message: `Processed ${results.success} sales successfully, ${results.failed} failed`
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Real-time Product Ingestion
exports.ingestProduct = async (req, res) => {
  try {
    const productData = req.body;
    
    // Check if product exists (by SKU or barcode)
    let product;
    if (productData.sku) {
      product = await Product.findOne({ sku: productData.sku });
    } else if (productData.barcode) {
      product = await Product.findOne({ barcode: productData.barcode });
    }

    if (product) {
      // Update existing product
      Object.assign(product, productData);
      await product.save();
      await kafkaProducer.sendProduct(product.toObject());
      return res.json({
        success: true,
        action: 'updated',
        productId: product._id
      });
    } else {
      // Create new product
      product = new Product(productData);
      await product.save();
      await kafkaProducer.sendProduct(product.toObject());
      return res.status(201).json({
        success: true,
        action: 'created',
        productId: product._id
      });
    }
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Real-time Client Ingestion
exports.ingestClient = async (req, res) => {
  try {
    const clientData = req.body;
    
    // Check if client exists (by email or phone)
    let client;
    if (clientData.clientEmail) {
      client = await Client.findOne({ clientEmail: clientData.clientEmail });
    } else if (clientData.clientPhone) {
      client = await Client.findOne({ clientPhone: clientData.clientPhone });
    }

    if (client) {
      // Update existing client
      Object.assign(client, clientData);
      await client.save();
      await kafkaProducer.sendClient(client.toObject());
      return res.json({
        success: true,
        action: 'updated',
        clientId: client._id
      });
    } else {
      // Create new client
      client = new Client(clientData);
      await client.save();
      await kafkaProducer.sendClient(client.toObject());
      return res.status(201).json({
        success: true,
        action: 'created',
        clientId: client._id
      });
    }
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Real-time Employee Ingestion
exports.ingestEmployee = async (req, res) => {
  try {
    const employeeData = req.body;
    
    // Check if employee exists (by email)
    let employee;
    if (employeeData.employeeEmail) {
      employee = await Employee.findOne({ employeeEmail: employeeData.employeeEmail });
    }

    if (employee) {
      // Update existing employee
      Object.assign(employee, employeeData);
      await employee.save();
      await kafkaProducer.sendEmployee(employee.toObject());
      return res.json({
        success: true,
        action: 'updated',
        employeeId: employee._id
      });
    } else {
      // Create new employee
      employee = new Employee(employeeData);
      await employee.save();
      await kafkaProducer.sendEmployee(employee.toObject());
      return res.status(201).json({
        success: true,
        action: 'created',
        employeeId: employee._id
      });
    }
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Real-time Payment Ingestion
exports.ingestPayment = async (req, res) => {
  try {
    const Payment = require('../models/CRUD/Payment');
    const paymentData = req.body;

    if (!paymentData.saleId) {
      return res.status(400).json({ 
        success: false,
        error: 'saleId is required' 
      });
    }

    const payment = new Payment(paymentData);
    await payment.save();
    
    await kafkaProducer.sendPayment(payment.toObject());

    res.status(201).json({
      success: true,
      paymentId: payment._id,
      timestamp: payment.paymentDate
    });
  } catch (error) {
    res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
};

// Health check for ingestion service
exports.ingestionHealth = async (req, res) => {
  try {
    // Check database connection
    const saleCount = await Sale.countDocuments();
    const recentSales = await Sale.countDocuments({
      saleTime: { $gte: new Date(Date.now() - 60000) } // Last minute
    });

    res.json({
      status: 'healthy',
      database: 'connected',
      totalSales: saleCount,
      recentSales: recentSales,
      timestamp: new Date()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
};

