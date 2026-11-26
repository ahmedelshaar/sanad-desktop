import { createRoot } from 'react-dom/client';
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import '@fontsource/cairo/800.css';
import './styles.css';
import App from './App.jsx';
import VoucherPrint, { BookPrint } from './print/VoucherPrint.jsx';

const printMatch = window.location.hash.match(/^#\/print\/(\d+)/);
const bookMatch = window.location.hash.match(/^#\/print-book\/(\d+)/);

createRoot(document.getElementById('root')).render(
  printMatch ? <VoucherPrint id={printMatch[1]} /> : bookMatch ? <BookPrint bookId={bookMatch[1]} /> : <App />
);
