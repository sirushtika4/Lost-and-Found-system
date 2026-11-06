import { useNavigate } from 'react-router-dom';
import ReportItemForm from '../components/forms/ReportItemForm';

export default function ReportLostPage() {
  const navigate = useNavigate();

  const handleSubmit = (values) => {
    console.log('Lost item submitted', values);
    navigate('/items');
  };

  return (
    <div className="container section-block page-shell narrow-page">
      <div className="page-header-row">
        <div>
          <span className="eyebrow">Campus safety</span>
          <h1>Report a Lost Item</h1>
        </div>
      </div>
      <div className="panel">
        <ReportItemForm mode="lost" onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
