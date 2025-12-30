const { sendMessage, TOPICS } = require('../config/kafka');

/**
 * Kafka Producer Service
 * Sends messages to Kafka Topics
 */

// Statistics tracking
let producerStats = {
  sales: 0,
  saleItems: 0,
  products: 0,
  clients: 0,
  employees: 0,
  payments: 0,
  analytics: 0,
  errors: 0
};

exports.getStats = () => ({ ...producerStats });

// Send Sale to Kafka
exports.sendSale = async (saleData) => {
  const message = {
    key: saleData.companyId || saleData._id?.toString(),
    value: JSON.stringify({
      ...saleData,
      timestamp: new Date().toISOString(),
      eventType: 'sale.created'
    })
  };
  
  const result = await sendMessage(TOPICS.SALES, message);
  if (result) {
    producerStats.sales++;
    console.log(`[KAFKA PRODUCER] ✅ Sent sale to topic '${TOPICS.SALES}': ${saleData._id || saleData.saleId || 'N/A'} (Total sales sent: ${producerStats.sales})`);
  } else {
    producerStats.errors++;
    console.error(`[KAFKA PRODUCER] ❌ Failed to send sale to topic '${TOPICS.SALES}': ${saleData._id || saleData.saleId || 'N/A'}`);
  }
  return result;
};

// Send Product to Kafka
exports.sendProduct = async (productData) => {
  const message = {
    key: productData.companyId || productData._id?.toString(),
    value: JSON.stringify({
      ...productData,
      timestamp: new Date().toISOString(),
      eventType: 'product.created'
    })
  };
  
  const result = await sendMessage(TOPICS.PRODUCTS, message);
  if (result) {
    producerStats.products++;
    console.log(`[KAFKA PRODUCER] ✅ Sent product to topic '${TOPICS.PRODUCTS}': ${productData._id || productData.productId || 'N/A'} (Total products sent: ${producerStats.products})`);
  } else {
    producerStats.errors++;
    console.error(`[KAFKA PRODUCER] ❌ Failed to send product to topic '${TOPICS.PRODUCTS}': ${productData._id || productData.productId || 'N/A'}`);
  }
  return result;
};

// Send Client to Kafka
exports.sendClient = async (clientData) => {
  const message = {
    key: clientData.companyId || clientData._id?.toString(),
    value: JSON.stringify({
      ...clientData,
      timestamp: new Date().toISOString(),
      eventType: 'client.created'
    })
  };
  
  const result = await sendMessage(TOPICS.CLIENTS, message);
  if (result) {
    producerStats.clients++;
    console.log(`[KAFKA PRODUCER] ✅ Sent client to topic '${TOPICS.CLIENTS}': ${clientData._id || clientData.clientId || 'N/A'} (Total clients sent: ${producerStats.clients})`);
  } else {
    producerStats.errors++;
    console.error(`[KAFKA PRODUCER] ❌ Failed to send client to topic '${TOPICS.CLIENTS}': ${clientData._id || clientData.clientId || 'N/A'}`);
  }
  return result;
};

// Send Employee to Kafka
exports.sendEmployee = async (employeeData) => {
  const message = {
    key: employeeData.companyId || employeeData._id?.toString(),
    value: JSON.stringify({
      ...employeeData,
      timestamp: new Date().toISOString(),
      eventType: 'employee.created'
    })
  };
  
  const result = await sendMessage(TOPICS.EMPLOYEES, message);
  if (result) {
    producerStats.employees++;
    console.log(`[KAFKA PRODUCER] ✅ Sent employee to topic '${TOPICS.EMPLOYEES}': ${employeeData._id || employeeData.employeeId || 'N/A'} (Total employees sent: ${producerStats.employees})`);
  } else {
    producerStats.errors++;
    console.error(`[KAFKA PRODUCER] ❌ Failed to send employee to topic '${TOPICS.EMPLOYEES}': ${employeeData._id || employeeData.employeeId || 'N/A'}`);
  }
  return result;
};

// Send SaleItem to Kafka
exports.sendSaleItem = async (saleItemData) => {
  const message = {
    key: saleItemData.saleId?.toString() || saleItemData._id?.toString(),
    value: JSON.stringify({
      ...saleItemData,
      timestamp: new Date().toISOString(),
      eventType: 'sale_item.created'
    })
  };
  
  const result = await sendMessage(TOPICS.SALE_ITEMS, message);
  if (result) {
    producerStats.saleItems++;
    console.log(`[KAFKA PRODUCER] ✅ Sent sale item to topic '${TOPICS.SALE_ITEMS}': ${saleItemData._id || saleItemData.saleId || 'N/A'} (Total sale items sent: ${producerStats.saleItems})`);
  } else {
    producerStats.errors++;
    console.error(`[KAFKA PRODUCER] ❌ Failed to send sale item to topic '${TOPICS.SALE_ITEMS}': ${saleItemData._id || saleItemData.saleId || 'N/A'}`);
  }
  return result;
};

// Send Payment to Kafka
exports.sendPayment = async (paymentData) => {
  const message = {
    key: paymentData.saleId || paymentData._id?.toString(),
    value: JSON.stringify({
      ...paymentData,
      timestamp: new Date().toISOString(),
      eventType: 'payment.created'
    })
  };
  
  const result = await sendMessage(TOPICS.PAYMENTS, message);
  if (result) {
    producerStats.payments++;
    console.log(`[KAFKA PRODUCER] ✅ Sent payment to topic '${TOPICS.PAYMENTS}': ${paymentData._id || paymentData.paymentId || 'N/A'} (Total payments sent: ${producerStats.payments})`);
  } else {
    producerStats.errors++;
    console.error(`[KAFKA PRODUCER] ❌ Failed to send payment to topic '${TOPICS.PAYMENTS}': ${paymentData._id || paymentData.paymentId || 'N/A'}`);
  }
  return result;
};

// Send Analytics Event to Kafka
exports.sendAnalytics = async (analyticsData) => {
  const message = {
    key: analyticsData.companyId || 'analytics',
    value: JSON.stringify({
      ...analyticsData,
      timestamp: new Date().toISOString(),
      eventType: 'analytics.updated'
    })
  };
  
  const result = await sendMessage(TOPICS.ANALYTICS, message);
  if (result) {
    producerStats.analytics++;
    console.log(`[KAFKA PRODUCER] ✅ Sent analytics to topic '${TOPICS.ANALYTICS}': ${analyticsData.companyId || 'N/A'} (Total analytics sent: ${producerStats.analytics})`);
  } else {
    producerStats.errors++;
    console.error(`[KAFKA PRODUCER] ❌ Failed to send analytics to topic '${TOPICS.ANALYTICS}': ${analyticsData.companyId || 'N/A'}`);
  }
  return result;
};

