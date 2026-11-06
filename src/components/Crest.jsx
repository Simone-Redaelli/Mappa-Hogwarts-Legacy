export default function Crest({ size = 56 }) {
  return (
    <svg className="crest" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5" />
      <circle cx="32" cy="32" r="23" fill="none" stroke="currentColor" strokeOpacity=".2" strokeWidth="1" strokeDasharray="2 3" />
      <path
        d="M32 9l3.6 16.4L52 32l-16.4 3.6L32 55l-3.6-19.4L9 32l19.4-6.6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="32" r="3.5" fill="currentColor" />
    </svg>
  );
}
