import "./Card.css";

function Card({ children, className = "", ...props }) {
  return (
    <div className={`tmc-card ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

Card.displayName = "Card";

Card.Header = function CardHeader({ children, className = "", ...props }) {
  return (
    <div className={`tmc-card-header ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

Card.Body = function CardBody({ children, className = "", ...props }) {
  return (
    <div className={`tmc-card-body ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

Card.Footer = function CardFooter({ children, className = "", ...props }) {
  return (
    <div className={`tmc-card-footer ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

export default Card;
