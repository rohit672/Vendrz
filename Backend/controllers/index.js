const Item = require("../models/item");
const Vendor = require("../models/vendor");
const User = require("../models/user");
const Category = require("../models/category");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function isValidId(id) {
    return require("mongoose").Types.ObjectId.isValid(id);
}

exports.postLogin = async (req, res, next) => {
    let { email, password } = req.body;
    let isVendor = false;
    let user = await User.findOne({ email: email });
    if (!user) {
        user = await Vendor.findOne({ email: email });
        if (!user) {
            return res.json({ success: false, message: "Email or password does not match" });
        } else {
            isVendor = true;
        }
    }
    if (bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign({ userId: user._id, isVendor }, process.env.JWT_SECRET, {
            expiresIn: "1d"
        });
        return res.json({ success: true, message: "Logged in successfully", user, token });
    } else {
        return res.json({ success: false, message: "Email or password does not match" });
    }
};  

exports.postRegister = async (req, res, next) => {

    let { name, email, password, user_type, contact , city , locality } = req.body;

    // Check if user exists already
    let user = await User.findOne({ email: email });
    if (user) {
        return res.json({ success: false, message: "Sorry Email is already taken" });
    }
    user = await Vendor.findOne({ email: email });
    if (user) {
        return res.json({ success: false, message: "Sorry Email is already taken" });
    }

    // Hashing Password
    const hashedPassword = await bcrypt.hash(password, 8);

    if (user_type === "user") {

        user = new User({
            name: name,
            email: email,
            password: hashedPassword,
            contact: contact,
            city : city , 
            locality : locality 
        });

    } else {
        user = new Vendor({
            name: name,
            email: email,
            password: hashedPassword,
            contact: contact,
            city : city , 
            locality : locality    
        });
    }
    user = await user.save();
    if (!user) {
        return res.json({ success: false, message: "Registration Failed" });
    }
    res.json({ success: true, message: "Registration Successful", user });
};

exports.getAllProducts = async (req, res, next) => {
    let query = {};
    let category_id = req.query.category_id;
    let category_name = req.query.category;
    let vendor_id = req.query.vendor_id;
    let min_cost = req.query.min_cost;
    let max_cost = req.query.max_cost;
    if (category_id) {
        if (!isValidId(category_id)) {
            return res.json({ success: false, message: "Invalid Category Id" });
        }
        query.category = category_id;
    } else if (category_name) {
        const __category__ = await Category.find({ name: category_name });
        if (__category__) {
            query.category = __category__._id;
        }
    }
    if (min_cost && max_cost) {
        query.cost = { $gte: min_cost, $lte: max_cost };
    } else if (min_cost) {
        query.cost = { $gte: min_cost };
    } else if (max_cost) {
        query.cost = { $lte: max_cost };
    }
    if(vendor_id) {
	if (!isValidId(vendor_id)) {
            return res.json({ success: false, message: "Invalid Vendor Id" });
        }
        query.seller = vendor_id;
    }
    const items = await Item.find(query).populate("category").populate("seller", "-password");
    if (!items) return res.json({ success: false, message: "No Items found!" });
    return res.json({ success: true, message: "Products found successfully", items });
};

exports.getOneProduct = async (req, res, next) => {
    if (!isValidId(req.params.id)) {
        return res.json({ success: false, message: "Invalid Item Id" });
    }
    const item = await Item.findById(req.params.id)
        .populate("category")
        .populate("seller", "-password");
    if (!item) return res.json({ success: false, message: "No product found with that id" });
    res.json({ success: true, message: "Product found successfully", item });
};

exports.getAllVendors = async (req, res, next) => {
    const vendors = await Vendor.find().select("-password");
    if (!vendors) return res.json({ success: false, message: "No vendor found" });
    const data = [];
    for (let i = 0; i < vendors.length; i++) {
        let user = vendors[i];
        const items = await Item.find({ seller: user._id }).select("-cloudinary_id");
        user = { ...user._doc, products: items };
        console.log(user);
        data.push(user);
    }
    res.json({ success: true, message: "Vendors found successfully", vendors: data });
};

exports.getOneVendor = async (req, res, next) => {
    if (!isValidId(req.params.id)) {
        return res.json({ success: false, message: "Invalid Vendor Id" });
    }
    const vendor = await Vendor.findById(req.params.id).select("-password");
    if (!vendor) return res.json({ success: false, message: "No vendor found with that Id" });
    const items = await Item.find({ seller: vendor._id });
    res.json({ success: true, message: "Vendor found successfully", vendor, items });
};

exports.postCategory = async (req, res, next) => {
    let { name } = req.body;
    let category = new Category({ name: name });
    category = await category.save();
    if (!category) {
        return res.json({
            success: false,
            message: "Error creating that category"
        });
    }

    res.json({
        success: true,
        message: "Category added successfully",
        category: category
    });
};

exports.getCategory = async (req, res, next) => {
    const categories = await Category.find();
    if (!categories) {
        return res.json({ success: false, message: "No categories found" });
    }
    res.json({
        success: true,
        message: "Categories found successfully",
        categories: categories
    });
};

exports.filterProductCategory = async (req, res, next) => {
    const id = req.params.id;
    const data = await Item.find({ category: id }).populate("category").populate("seller", "-password");
    if (!data) return res.json({ success: false, message: "Error fetching products" });
    return res.json({ success: true, data });
};

exports.filterProductVendor = async (req, res, next) => {
    const id = req.params.id;
    const data = await Item.find({ seller: id }).populate("category").populate("seller", "-password");
    if (!data) return res.json({ success: false, message: "Error fetching products" });
    return res.json({ success: true, data });
};

exports.verifyJWT = async (req, res, next) => {
    const token = req.headers["x-access-token"];

    if (!token) {
        return res.json({ success: false, message: "Authentication failed" });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, data) => {
        if (err) return res.json({ success: false, message: "Authentication required!" });

        let user = await User.findById(data.userId).select("-password");
        if (user) return res.json({ success: true, user });
        user = await Vendor.findById(data.userId);
        if (user) return res.json({ success: true, user });

        return res.json({ success: false, message: "Failed Attempt!" });
    });
};
