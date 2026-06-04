interface OrderRowProps {
  image: string
  title: string
  buyerName: string
  timeAgo: string
  status: 'Paid' | 'Shipped' | 'Delivered'
}

export default function OrderRow({
  image,
  title,
  buyerName,
  timeAgo,
  status,
}: OrderRowProps) {
  const statusColors = {
    Paid: 'bg-[#2D5F5D] text-white',
    Shipped: 'bg-[#E8B43D] text-[#1F1410]',
    Delivered: 'bg-[#4A7C59] text-white',
  }

  return (
    <div className="flex items-center gap-4 py-4 border-b border-[#F5F0E8]">
      {/* Product Thumbnail */}
      <img
        src={image}
        alt={title}
        className="w-14 h-14 rounded object-cover flex-shrink-0"
      />

      {/* Order Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[16px] text-[#1F1410] truncate">
          {title}
        </p>
        <p className="text-[#7D6F66] text-[13px] font-normal">
          {buyerName} · {timeAgo}
        </p>
      </div>

      {/* Status Pill */}
      <div
        className={`px-3 py-1 rounded-full text-[13px] font-medium flex-shrink-0 ${
          statusColors[status]
        }`}
      >
        {status}
      </div>
    </div>
  )
}
