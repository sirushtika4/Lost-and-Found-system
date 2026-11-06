import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mockItems } from '../utils/mockData';
import ReportItemForm from '../components/forms/ReportItemForm';

export default function EditItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const initialValues = useMemo(() => {
    const item = mockItems.find((entry) => entry._id === id) || mockItems[0];
    return {
      title: item.title,
      category: item.category,
      description: item.description,
      color: item.color,
      brand: item.brand,
      location: item.location,
      date: item.dateLostOrFound,
      image: item.image,
    };
  }, [id]);

  const handleSubmit = (values) => {
    console.log('Edited item', values);
    navigate(`/items/${id}`);
  };

  return (
    <div className="container section-block page-shell narrow-page">
      <div className="page-header-row">
        <div>
          <span className="eyebrow">Update listing</span>
          <h1>Edit Item</h1>
        </div>
      </div>
      <div className="panel">
        <ReportItemForm mode="lost" initialValues={initialValues} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
