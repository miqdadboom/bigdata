const Product = require('../../models/CRUD/Product');

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const { 
      companyId, 
      categoryId, 
      brand, 
      isActive, 
      minPrice, 
      maxPrice,
      page = 1, 
      limit = 50 
    } = req.query;
    
    const query = {};
    
    if (companyId) query.companyId = companyId;
    if (categoryId) query.categoryId = categoryId;
    if (brand) query.brand = brand;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    if (minPrice || maxPrice) {
      query.productPrice = {};
      if (minPrice) query.productPrice.$gte = Number(minPrice);
      if (maxPrice) query.productPrice.$lte = Number(maxPrice);
    }

    const products = await Product.find(query)
      .populate('categoryId', 'categoryName')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await Product.countDocuments(query);

    res.json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('categoryId');
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create product
exports.createProduct = async (req, res) => {
  try {
    const product = new Product(req.body);
    await product.save();
    await product.populate('categoryId', 'categoryName');
    res.status(201).json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('categoryId', 'categoryName');
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete product
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get products by brand (for analytics)
exports.getProductsByBrand = async (req, res) => {
  try {
    const { brand } = req.params;
    const products = await Product.find({ brand, isActive: true })
      .populate('categoryId', 'categoryName')
      .sort({ productName: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

