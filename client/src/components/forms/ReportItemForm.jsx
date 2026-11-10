import { useState } from 'react';
import Button from '../common/Button';
import { useNavigate } from 'react-router-dom';

const emptyForm = {
  title: '',
  category: 'Electronics',
  description: '',
  color: '',
  brand: '',
  location: '',
  date: '',
  image: '',
};

export default function ReportItemForm({ mode = 'lost', initialValues = emptyForm, onSubmit, submitting = false }) {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialValues || emptyForm);
  const [errors, setErrors] = useState({});

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    const requiredFields = ['title', 'category', 'description', 'location', 'date'];
    requiredFields.forEach((field) => {
      if (!form[field]?.toString().trim()) {
        nextErrors[field] = 'This field is required.';
      }
    });
    if (form.image) {
      try { const url = new URL(form.image); if (url.protocol !== 'https:' || url.username || url.password) nextErrors.image = 'Use an HTTPS image URL without credentials.'; }
      catch { nextErrors.image = 'Enter a valid HTTPS image URL.'; }
    }
    if (form.date > new Date().toISOString().slice(0, 10)) nextErrors.date = 'The date cannot be in the future.';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return false;
    }

    return true;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) return;
    onSubmit({ ...form, type: mode });
  };

  return (
    <form className="report-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid two-col">
        <div className="field-group">
          <label htmlFor="title">Item title</label>
          <input id="title" name="title" maxLength={150} value={form.title} onChange={handleChange} placeholder="Black Samsung Phone" />
          {errors.title ? <span className="field-error">{errors.title}</span> : null}
        </div>

        <div className="field-group">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" value={form.category} onChange={handleChange}>
            {['Electronics', 'Wallets', 'Bags', 'Keys', 'Documents', 'Books', 'Jewellery', 'Clothing', 'ID Cards', 'Other'].map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          {errors.category ? <span className="field-error">{errors.category}</span> : null}
        </div>
      </div>

      <div className="field-group">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" maxLength={4000} value={form.description} onChange={handleChange} rows={5} placeholder="Describe the item, where it was last seen, and any distinguishing details." />
        {errors.description ? <span className="field-error">{errors.description}</span> : null}
      </div>

      <div className="form-grid three-col">
        <div className="field-group">
          <label htmlFor="color">Color</label>
          <input id="color" name="color" maxLength={80} value={form.color} onChange={handleChange} placeholder="Black" />
        </div>

        <div className="field-group">
          <label htmlFor="brand">Brand</label>
          <input id="brand" name="brand" maxLength={100} value={form.brand} onChange={handleChange} placeholder="Samsung" />
        </div>

        <div className="field-group">
          <label htmlFor="date">Date {mode === 'lost' ? 'lost' : 'found'}</label>
          <input id="date" type="date" name="date" value={form.date} onChange={handleChange} />
          {errors.date ? <span className="field-error">{errors.date}</span> : null}
        </div>
      </div>

      <div className="form-grid two-col">
        <div className="field-group">
          <label htmlFor="location">Location</label>
          <input id="location" name="location" maxLength={200} value={form.location} onChange={handleChange} placeholder="Engineering Library" />
          {errors.location ? <span className="field-error">{errors.location}</span> : null}
        </div>

        <div className="field-group">
          <label htmlFor="image-upload">Image</label>
          <input id="image-upload" name="image" type="url" maxLength={2000} value={form.image} onChange={handleChange} placeholder="https://example.com/item.jpg" />
          <small>Optional HTTPS image URL. File uploads are not available yet.</small>
          {errors.image ? <span className="field-error">{errors.image}</span> : null}
        </div>
      </div>

      {form.image ? (
        <div className="image-preview-box">
          <img src={form.image} alt="Preview of selected item" className="preview-image" />
        </div>
      ) : null}

      <div className="form-actions">
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Submitting...' : mode === 'lost' ? 'Submit Lost Report' : 'Submit Found Report'}
        </Button>
        <Button type="button" variant="secondary" disabled={submitting} onClick={() => navigate(-1)}>Cancel</Button>
      </div>
    </form>
  );
}
