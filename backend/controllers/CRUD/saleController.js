const Sale = require('../../models/CRUD/Sale');
const SaleItem = require('../../models/CRUD/SaleItem');

// Get all sales
exports.getAllSales = async (req, res) => {
  try {
    const { 
      companyId, 
      branchId, 
      region, 
      clientId, 
      employeeId,
      saleStatus,
      saleType,
      startDate,
      endDate,
      page = 1, 
      limit = 50 
    } = req.query;
    
    const query = {};
    
    if (companyId) query.companyId = companyId;
    if (branchId) query.branchId = branchId;
    if (region) query.region = region;
    if (clientId) query.clientId = clientId;
    if (employeeId) query.employeeId = employeeId;
    if (saleStatus) query.saleStatus = saleStatus;
    if (saleType) query.saleType = saleType;
    
    if (startDate || endDate) {
      query.saleTime = {};
      if (startDate) query.saleTime.$gte = new Date(startDate);
      if (endDate) query.saleTime.$lte = new Date(endDate);
    }

    const sales = await Sale.find(query)
      .populate('clientId', 'clientName clientLocation')
      .populate('employeeId', 'employeeName')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ saleTime: -1 });

    const total = await Sale.countDocuments(query);

    res.json({
      sales,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get sale by ID
exports.getSaleById = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('clientId')
      .populate('employeeId');
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const saleItems = await SaleItem.find({ saleId: sale._id })
      .populate('productId', 'productName productPrice brand');

    res.json({ sale, saleItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create sale
exports.createSale = async (req, res) => {
  try {
    const saleData = req.body;
    const saleItems = saleData.items || [];
    delete saleData.items;

    const sale = new Sale(saleData);
    await sale.save();

    // Create sale items
    if (saleItems.length > 0) {
      const items = saleItems.map(item => ({
        ...item,
        saleId: sale._id
      }));
      await SaleItem.insertMany(items);
    }

    // Calculate total amount
    const items = await SaleItem.find({ saleId: sale._id });
    const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
    sale.totalAmount = totalAmount;
    await sale.save();

    const populatedSale = await Sale.findById(sale._id)
      .populate('clientId')
      .populate('employeeId');

    res.status(201).json(populatedSale);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update sale
exports.updateSale = async (req, res) => {
  try {
    const sale = await Sale.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('clientId')
      .populate('employeeId');
    
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    res.json(sale);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete sale
exports.deleteSale = async (req, res) => {
  try {
    // Delete sale items first
    await SaleItem.deleteMany({ saleId: req.params.id });
    
    const sale = await Sale.findByIdAndDelete(req.params.id);
    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    res.json({ message: 'Sale deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

