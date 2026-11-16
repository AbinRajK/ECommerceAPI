const mongoose = require('mongoose');
const { PRODUCT_STATUS } = require('../config/constants');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    sku: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true, maxlength: 5000 },
    price: { type: Number, required: true, min: 0 },
    salePrice: {
      type: Number,
      min: 0,
      validate: {
        validator(value) {
          return value == null || value <= this.price;
        },
        message: 'salePrice cannot be greater than price',
      },
    },
    // Denormalised price actually charged (salePrice if set, else price) so that
    // price filtering and sorting can use a plain index.
    effectivePrice: { type: Number, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    status: { type: String, enum: Object.values(PRODUCT_STATUS), default: PRODUCT_STATUS.ACTIVE },
  },
  { timestamps: true }
);

productSchema.pre('validate', function setEffectivePrice() {
  this.effectivePrice = this.salePrice != null ? this.salePrice : this.price;
});

productSchema.index({ category: 1, status: 1, effectivePrice: 1 });
productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ name: 1 });

module.exports = mongoose.model('Product', productSchema);
