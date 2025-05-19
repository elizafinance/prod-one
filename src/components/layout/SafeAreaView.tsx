import React from 'react';

interface SafeAreaViewProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const SafeAreaView: React.FC<SafeAreaViewProps> = ({ children, className, ...props }) => {
  return (
    <div
      className={`flex-grow w-full ${className || ''}`}
      // The safe area padding is now globally applied to the body in globals.css.
      // This component is a semantic wrapper and can be used to apply additional
      // layout constraints if needed, or to specifically denote sections
      // that are intended to respect the safe areas.
      // For now, it primarily acts as a structural element.
      {...props}
    >
      {children}
    </div>
  );
};

export default SafeAreaView; 