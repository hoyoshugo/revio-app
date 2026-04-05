import { getInitials, avatarColor } from '../../lib/utils.js';

const sizes = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
  xl: 'w-20 h-20 text-2xl',
};

export default function Avatar({ firstName = '', lastName = '', size = 'md', className = '' }) {
  return (
    <div className={`${sizes[size]} ${avatarColor(firstName + lastName)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}>
      {getInitials(firstName, lastName)}
    </div>
  );
}
