import { useNavigate } from 'react-router-dom';
import ReportItemForm from '../components/forms/ReportItemForm';

export default function ReportFoundPage() {
  const navigate = useNavigate();

  const handleSubmit = (values) => {
    console.log('Found item submitted', values);
    navigate('/items');
  };

  return (
    <div className="container section-block page-shell narrow-page">
      <div className="page-header-row">
        <div>
          <span className="eyebrow">Community help</span>
          <h1>Report a Found Item</h1>
        </div>
      </div>
      <div className="panel">
        <ReportItemForm mode="found" onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
