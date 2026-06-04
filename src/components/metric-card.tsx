interface MetricCardProps {
  number: string | number
  label: string
  numberColor?: 'indigo' | 'coral'
}

export default function MetricCard({
  number,
  label,
  numberColor = 'indigo',
}: MetricCardProps) {
  const numberColorClass =
    numberColor === 'coral' ? 'text-[#D67961]' : 'text-[#2D5F5D]'

  return (
    <div className="bg-white rounded-lg shadow-sm p-5">
      <p className={`font-serif text-[24px] font-normal ${numberColorClass}`}>
        {number}
      </p>
      <p className="text-[#7D6F66] text-[13px] font-normal mt-2">
        {label}
      </p>
    </div>
  )
}
