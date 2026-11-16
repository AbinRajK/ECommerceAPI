const mongoose = require('mongoose');
const { slugify } = require('../utils/helpers');

/**
 * Hierarchy is modelled with a parent reference + a materialised `ancestors` path
 * (ordered root -> direct parent). This gives:
 *   - children of X:            find({ parent: X })
 *   - ALL descendants of X:     find({ ancestors: X })      (single indexed query, any depth)
 *   - breadcrumb / depth:       ancestors array
 *   - cycle detection:          newParent.ancestors.includes(X)
 * Trade-off: moving a subtree requires rewriting descendants' ancestors (done in a transaction).
 */
const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, lowercase: true },
    description: { type: String, trim: true, maxlength: 1000 },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    ancestors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Sibling categories must have unique names (same name allowed under different parents).
categorySchema.index({ parent: 1, slug: 1 }, { unique: true });
categorySchema.index({ ancestors: 1 });

categorySchema.pre('validate', function setSlug() {
  if (this.isModified('name')) this.slug = slugify(this.name);
});

module.exports = mongoose.model('Category', categorySchema);
