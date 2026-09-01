import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// Password field with a show/hide eye toggle. Pass the same input className
// you'd use elsewhere — `pr-11` is appended to leave room for the icon.
const PasswordInput = ({ value, onChange, placeholder, required, className = '', iconClassName = 'text-gray-400 hover:text-gray-600', id }) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        required={required}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${className} pr-11`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${iconClassName}`}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
};

export default PasswordInput;
