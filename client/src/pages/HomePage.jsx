import { Link } from 'react-router-dom';
import { ArrowRight, Search, ShieldCheck, Smartphone, Wallet, BriefcaseBusiness, KeyRound, FileText, BookOpen, Gem, Shirt, BadgeCheck, Boxes } from 'lucide-react';
import { mockItems, mockStats } from '../utils/mockData';
import ItemCard from '../components/items/ItemCard';
import Button from '../components/common/Button';

const categoryIcons = {
  Electronics: Smartphone,
  Wallets: Wallet,
  Bags: BriefcaseBusiness,
  Keys: KeyRound,
  Documents: FileText,
  Books: BookOpen,
  Jewellery: Gem,
  Clothing: Shirt,
  'ID Cards': BadgeCheck,
  Other: Boxes,
};

const categories = [
  'Electronics',
  'Wallets',
  'Bags',
  'Keys',
  'Documents',
  'Books',
  'Jewellery',
  'Clothing',
  'ID Cards',
  'Other',
];

const statsConfig = [
  { label: 'Lost Items', value: mockStats.lostItems, icon: 'lost' },
  { label: 'Found Items', value: mockStats.foundItems, icon: 'found' },
  { label: 'Items Returned', value: mockStats.itemsReturned, icon: 'returned' },
  { label: 'Community Members', value: mockStats.communityMembers, icon: 'members' },
];

export default function HomePage() {
  return (
    <>
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Trusted campus recovery network</span>
            <h1>Lost Something? Found Something?</h1>
            <p>Helping lost belongings find their way back home.</p>
            <div className="hero-actions">
              <Link to="/report/lost" className="btn btn-primary btn-lg">Report Lost Item</Link>
              <Link to="/report/found" className="btn btn-secondary btn-lg">Report Found Item</Link>
            </div>
            <div className="search-shell wide-search">
              <Search size={18} />
              <input type="text" value="" readOnly placeholder="Search for phones, wallets, keys, documents..." aria-label="Search items" />
              <Link to="/items" className="search-button">Browse Items</Link>
            </div>
          </div>

          <div className="hero-panel">
            <div className="mini-card card-spotlight">
              <div className="panel-topline">
                <span className="status-badge status-lost">Lost</span>
                <span className="state-chip open">Open</span>
              </div>
              <h3>Black Samsung Phone</h3>
              <p>Engineering Library • 27 Sep 2026</p>
              <div className="mini-meta">
                <span><ShieldCheck size={16} /> Verified</span>
                <span>Electronics</span>
              </div>
            </div>
            <div className="mini-card card-accent">
              <h4>Community recovery</h4>
              <p>Over 1,800 members helping return lost belongings safely.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-section">
        <div className="container stats-grid">
          {statsConfig.map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className="stat-icon">
                {stat.icon === 'lost' ? <ShieldCheck size={18} /> : stat.icon === 'found' ? <Search size={18} /> : stat.icon === 'returned' ? <ArrowRight size={18} /> : <ShieldCheck size={18} />}
              </div>
              <div>
                <h3>{stat.value}</h3>
                <p>{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="container section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Browse by category</span>
            <h2>Popular item categories</h2>
          </div>
        </div>

        <div className="category-grid">
          {categories.map((category) => {
            const Icon = categoryIcons[category] || Boxes;
            return (
              <Link key={category} to={`/items?category=${encodeURIComponent(category)}`} className="category-card">
                <div className="category-icon"><Icon size={22} /></div>
                <span>{category}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Fresh reports</span>
            <h2>Recently reported items</h2>
          </div>
          <Link to="/items" className="text-link">Browse all</Link>
        </div>

        <div className="item-grid home-grid">
          {mockItems.slice(0, 4).map((item) => (
            <ItemCard key={item._id} item={item} />
          ))}
        </div>
      </section>
    </>
  );
}
