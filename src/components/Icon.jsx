import React from 'react';
import * as LucideReact from 'lucide-react';

/**
 * Dynamic Lucide Icon component
 * @param {string} name - Name of the Lucide icon in PascalCase or camelCase
 * @param {string} className - Tailwind CSS classes
 * @param {number} size - Size in pixels
 */
export default function Icon({ name, className = '', size = 20, ...props }) {
  // Convert kebab-case (e.g. 'book-open') or lowercase to PascalCase (e.g. 'BookOpen')
  const pascalName = name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  const LucideIcon = LucideReact[pascalName] || LucideReact.HelpCircle;

  return <LucideIcon className={className} size={size} {...props} />;
}
