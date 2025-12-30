const SaleItem = require('../../models/CRUD/SaleItem');
const Sale = require('../../models/CRUD/Sale');

// Get all sale items
exports.getAllSaleItems = async (req, res) => {
  try {
    const { saleId, productId, categoryId, brand, page = 1, limit = 100 } = req.query;
    const query = {};
    
    if (saleId) query.saleId = saleId;
    if (productId) query.productId = productId;
    if (categoryId) query.categoryId = categoryId;
    if (brand) query.brand = brand;

    const saleItems = await SaleItem.find(query)
      .populate('saleId', 'saleTime saleStatus totalAmount')
      .populate('productId', 'productName productPrice brand')
      .populate('categoryId', 'categoryName')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await SaleItem.countDocuments(query);

    res.json({
      saleItems,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get sale item by ID
exports.getSaleItemById = async (req, res) => {
  try {
    const saleItem = await SaleItem.findById(req.params.id)
      .populate('saleId')
      .populate('productId')
      .populate('categoryId');
    
    if (!saleItem) {
      return res.status(404).json({ error: 'Sale item not found' });
    }
    res.json(saleItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create sale item
exports.createSaleItem = async (req, res) => {
  try {
    const saleItem = new SaleItem(req.body);
    await saleItem.save();
    
    // Update sale total
    await updateSaleTotal(saleItem.saleId);
    
    await saleItem.populate('productId');
    res.status(201).json(saleItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update sale item
exports.updateSaleItem = async (req, res) => {
  try {
    const saleItem = await SaleItem.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('productId');
    
    if (!saleItem) {
      return res.status(404).json({ error: 'Sale item not found' });
    }
    
    // Update sale total
    await updateSaleTotal(saleItem.saleId);
    
    res.json(saleItem);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete sale item
exports.deleteSaleItem = async (req, res) => {
  try {
    const saleItem = await SaleItem.findById(req.params.id);
    if (!saleItem) {
      return res.status(404).json({ error: 'Sale item not found' });
    }
    
    const saleId = saleItem.saleId;
    await SaleItem.findByIdAndDelete(req.params.id);
    
    // Update sale total
    await updateSaleTotal(saleId);
    
    res.json({ message: 'Sale item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper function to update sale total
async function updateSaleTotal(saleId) {
  const items = await SaleItem.find({ saleId });
  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);
  await Sale.findByIdAndUpdate(saleId, { totalAmount });
}

