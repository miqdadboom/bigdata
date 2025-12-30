require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const axios = require('axios');

// Helper to convert string ID to ObjectId
function toObjectId(id) {
  if (!id) return undefined;
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return id;
}

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

// Sample data - Enhanced with realistic company distribution
const companies = [
  // Pharmacies
  { id: 'pharmacy_001', name: 'صيدلية النور', type: 'pharmacy', sector: 'pharmacy', region: 'north westbank', city: 'رام الله' },
  { id: 'pharmacy_002', name: 'صيدلية الشفاء', type: 'pharmacy', sector: 'pharmacy', region: 'north westbank', city: 'نابلس' },
  { id: 'pharmacy_003', name: 'صيدلية الأمل', type: 'pharmacy', sector: 'pharmacy', region: 'south westbank', city: 'الخليل' },
  { id: 'pharmacy_004', name: 'صيدلية الحياة', type: 'pharmacy', sector: 'pharmacy', region: 'gaza', city: 'غزة' },
  
  // Supermarkets/Malls
  { id: 'mall_001', name: 'سوبر ماركت النور', type: 'retail', sector: 'mall', region: 'north westbank', city: 'رام الله' },
  { id: 'mall_002', name: 'سوبر ماركت الشفاء', type: 'retail', sector: 'mall', region: 'north westbank', city: 'نابلس' },
  { id: 'mall_003', name: 'سوبر ماركت الأمل', type: 'retail', sector: 'mall', region: 'south westbank', city: 'بيت لحم' },
  { id: 'mall_004', name: 'سوبر ماركت الحياة', type: 'retail', sector: 'mall', region: 'gaza', city: 'غزة' },
  
  // Distribution Companies
  { id: 'distribution_001', name: 'شركة الدواء', type: 'distribution', sector: 'distribution', region: 'north westbank', city: 'رام الله' },
  { id: 'distribution_002', name: 'شركة التوزيع الحديثة', type: 'distribution', sector: 'distribution', region: 'south westbank', city: 'الخليل' },
  { id: 'distribution_003', name: 'شركة التوزيع المتحدة', type: 'distribution', sector: 'distribution', region: 'gaza', city: 'غزة' }
];

const regions = ['gaza', 'north westbank', 'south westbank'];
const saleTypes = ['pharmacy', 'distribution', 'retail'];

// Palestinian cities by region
const citiesByRegion = {
  'gaza': ['غزة', 'خان يونس', 'رفح', 'دير البلح', 'جباليا', 'بيت لاهيا', 'النصيرات', 'البريج', 'المغازي'],
  'north westbank': ['رام الله', 'نابلس', 'جنين', 'طولكرم', 'قلقيلية', 'سلفيت', 'طوباس', 'بيت جالا', 'بيت ساحور'],
  'south westbank': ['الخليل', 'بيت لحم', 'أريحا']
};

// Product demand patterns by sector (for realistic data)
const productDemandBySector = {
  'pharmacy': {
    highDemand: ['مسكنات', 'مضادات حيوية', 'فيتامينات', 'أدوية السكري', 'أدوية الضغط'],
    mediumDemand: ['مستحضرات تجميل', 'مكملات غذائية', 'أدوية البرد'],
    lowDemand: ['أجهزة طبية', 'مستلزمات طبية']
  },
  'mall': {
    highDemand: ['مواد غذائية', 'مشروبات', 'منتجات الألبان', 'خضار', 'فواكه'],
    mediumDemand: ['منتجات التنظيف', 'منتجات العناية الشخصية', 'أدوات منزلية'],
    lowDemand: ['إلكترونيات', 'ملابس', 'أثاث']
  },
  'distribution': {
    highDemand: ['أدوية', 'مواد غذائية', 'مشروبات'],
    mediumDemand: ['منتجات التنظيف', 'مستحضرات تجميل'],
    lowDemand: ['إلكترونيات', 'أجهزة']
  }
};

// Employee performance patterns (for realistic employee metrics)
const employeePerformanceLevels = {
  high: { minSales: 15, maxSales: 30, avgSaleAmount: { min: 80, max: 200 } },
  medium: { minSales: 8, maxSales: 15, avgSaleAmount: { min: 50, max: 120 } },
  low: { minSales: 3, maxSales: 8, avgSaleAmount: { min: 30, max: 80 } }
};

let productIds = [];
let productsMap = new Map(); // Store products with brand info
let clientIds = [];
// Store employees by companyId
let employeesByCompany = {};

// Fetch existing data
async function fetchExistingData() {
  try {
    const [products, clients, employees] = await Promise.all([
      axios.get(`${API_URL}/products?limit=100`),
      axios.get(`${API_URL}/clients?limit=50`),
      axios.get(`${API_URL}/employees?limit=200`) // Get more employees to cover all companies
    ]);

    const productsList = products.data.products || [];
    productIds = productsList.map(p => p._id);
    // Create products map for quick brand lookup
    productsList.forEach(p => {
      productsMap.set(p._id.toString(), p);
    });
    clientIds = clients.data.clients?.map(c => c._id) || [];
    
    // Group employees by companyId
    const allEmployees = employees.data.employees || [];
    employeesByCompany = {};
    allEmployees.forEach(emp => {
      if (emp.companyId) {
        if (!employeesByCompany[emp.companyId]) {
          employeesByCompany[emp.companyId] = [];
        }
        employeesByCompany[emp.companyId].push(emp._id);
      }
    });

    const totalEmployees = Object.values(employeesByCompany).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`📦 Loaded: ${productIds.length} products, ${clientIds.length} clients`);
    console.log(`👥 Loaded: ${totalEmployees} employees across ${Object.keys(employeesByCompany).length} companies`);
  } catch (error) {
    console.error('WARNING:  Could not fetch existing data, will use random IDs');
  }
}

// Generate realistic sale amount based on sector and time
function getRealisticSaleAmount(sector, hour) {
  const baseAmounts = {
    'pharmacy': { min: 25, max: 150, peak: 80 },
    'mall': { min: 15, max: 200, peak: 100 },
    'distribution': { min: 100, max: 1000, peak: 500 }
  };
  
  const base = baseAmounts[sector] || baseAmounts['pharmacy'];
  
  // Peak hours (10-14, 18-21) have higher sales
  const isPeakHour = (hour >= 10 && hour <= 14) || (hour >= 18 && hour <= 21);
  const multiplier = isPeakHour ? 1.3 : 0.8;
  
  return Math.floor((Math.random() * (base.max - base.min) + base.min) * multiplier);
}

// Generate realistic number of items based on sector
function getRealisticItemCount(sector) {
  const itemCounts = {
    'pharmacy': { min: 1, max: 5 },
    'mall': { min: 3, max: 15 },
    'distribution': { min: 10, max: 50 }
  };
  
  const range = itemCounts[sector] || itemCounts['pharmacy'];
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

// Generate realistic product prices based on sector
function getRealisticPrice(sector, productId) {
  const priceRanges = {
    'pharmacy': { min: 5, max: 150 },
    'mall': { min: 2, max: 80 },
    'distribution': { min: 10, max: 200 }
  };
  
  const range = priceRanges[sector] || priceRanges['pharmacy'];
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

// Generate a random sale with realistic patterns
function generateSale() {
  const company = companies[Math.floor(Math.random() * companies.length)];
  const region = company.region || regions[Math.floor(Math.random() * regions.length)];
  const cities = citiesByRegion[region] || ['مدينة'];
  const city = company.city || cities[Math.floor(Math.random() * cities.length)];
  
  const now = new Date();
  const hour = now.getHours();
  
  // Realistic number of items based on sector
  const numItems = getRealisticItemCount(company.sector);
  
  // Realistic total amount
  const baseTotalAmount = getRealisticSaleAmount(company.sector, hour);
  
  const items = [];
  let remainingAmount = baseTotalAmount;
  
  // Distribute amount across items realistically
  for (let i = 0; i < numItems; i++) {
    const isLastItem = i === numItems - 1;
    const productId = productIds[Math.floor(Math.random() * productIds.length)] || 'product_id';
    
    let itemAmount;
    if (isLastItem) {
      // Last item gets remaining amount
      itemAmount = Math.max(remainingAmount, 5);
    } else {
      // Distribute amount across items
      const maxItemAmount = Math.floor(remainingAmount / (numItems - i) * 1.5);
      itemAmount = Math.floor(Math.random() * Math.min(maxItemAmount, remainingAmount * 0.6)) + 5;
      remainingAmount -= itemAmount;
    }
    
    const quantity = Math.floor(Math.random() * 3) + 1;
    const price = Math.floor(itemAmount / quantity);
    const subtotal = quantity * price;
    
    // Get product to extract brand
    const product = productsMap.get(productId?.toString());
    const brand = product?.brand || null;
    
    items.push({
      productId: productId,
      quantity: quantity,
      price: price,
      subtotal: subtotal,
      brand: brand // Add brand from product
    });
  }

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  // Map company.type to valid saleType enum values
  const saleTypeMap = {
    'pharmacy': 'pharmacy',
    'retail': 'retail',
    'distribution': 'distribution',
    'mall': 'retail' // malls use retail type
  };
  
  // Get random client ID
  const randomClientId = clientIds.length > 0 
    ? clientIds[Math.floor(Math.random() * clientIds.length)] 
    : null;
  
  // Get employee ID specific to this company
  let randomEmployeeId = null;
  const companyEmployees = employeesByCompany[company.id] || [];
  if (companyEmployees.length > 0) {
    randomEmployeeId = companyEmployees[Math.floor(Math.random() * companyEmployees.length)];
  }

  return {
    saleTime: now.toISOString(),
    saleStatus: 'completed',
    saleType: saleTypeMap[company.type] || 'retail',
    sector: company.sector,
    totalAmount: totalAmount,
    companyId: company.id,
    branchId: `branch_${String(Math.floor(Math.random() * 5) + 1).padStart(3, '0')}`,
    region: region,
    city: city,
    clientId: toObjectId(randomClientId), // Convert to ObjectId
    employeeId: toObjectId(randomEmployeeId), // Convert to ObjectId
    items: items,
    source: `${company.type}_pos_${String(Math.floor(Math.random() * 3) + 1).padStart(3, '0')}`
  };
}

// Send sale to ingestion API
async function sendSale(sale) {
  try {
    const response = await axios.post(`${API_URL}/ingestion/sales`, sale);
    return response.data;
  } catch (error) {
    // Log more details about the error
    if (error.response) {
      console.error(`ERROR: Error sending sale (${error.response.status}):`, error.response.data?.error || error.message);
    } else {
      console.error('ERROR: Error sending sale:', error.message);
    }
    return null;
  }
}

// Main function
async function startRealtimeDataGeneration() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await connectDB();

    console.log('📦 Fetching existing data...');
    await fetchExistingData();

    if (productIds.length === 0) {
      console.log('WARNING:  No products found. Please run: npm run generate-data first');
      process.exit(1);
    }

    console.log('\n Starting real-time data generation...');
    console.log(' Sending 3 sales per second');
    console.log('Press Ctrl+C to stop\n');

    let count = 0;

    // Send 3 sales per second (every 1000ms, send 3 sales)
    const interval = setInterval(async () => {
      // Generate and send 3 sales in parallel
      const sales = Array.from({ length: 3 }, () => generateSale());
      const results = await Promise.allSettled(sales.map(sale => sendSale(sale)));

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value && result.value.success) {
          count++;
          const sale = sales[index];
          console.log(`SUCCESS: Sale #${count} sent - Amount: $${sale.totalAmount.toFixed(2)} - ${sale.companyId} - ${sale.region}`);
        } else if (result.status === 'rejected') {
          console.error(`ERROR: Failed to send sale: ${result.reason?.message || 'Unknown error'}`);
        }
      });
    }, 1000); // Every 1 second, send 3 sales

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(`\n\n Stopped. Total sales sent: ${count}`);
      clearInterval(interval);
      process.exit(0);
    });

  } catch (error) {
    console.error('ERROR: Error:', error);
    process.exit(1);
  }
}

startRealtimeDataGeneration();

