export function MagoLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      <rect width="100" height="100" rx="22" fill="#3542FF" />
      <path
        fill="white"
        d="M 5,1 L 50,38 L 54,14 L 63,37 L 81,21 L 73,44 L 97,44 L 76,56 L 94,71 L 71,67 L 75,90 L 60,72 L 48,93 L 48,69 L 25,77 L 41,59 L 18,51 L 42,46 Z"
      />
    </svg>
  );
}
