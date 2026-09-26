import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {}

export const Badge: React.FC<BadgeProps> = ({ children, className = '', ...props }) => {
  return (
    <span
      className={`inline-flex items-center rounded-md font-medium ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
