export default function BalanceCard() {
  const balanceNaira = 142500
  const balanceSats = 142500

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
      {/* Balance Amount */}
      <div>
        <p className="text-[#7D6F66] text-sm font-medium uppercase tracking-widest mb-2">
          Your balance
        </p>
        <p className="font-serif text-[36px] text-[#D67961] font-normal" style={{ textDecoration: 'none' }}>
          ₦{balanceNaira.toLocaleString('en-US')}
        </p>
        <p className="text-[#7D6F66] text-sm font-normal mt-1">
          {balanceSats.toLocaleString('en-US')} sats
        </p>
      </div>

      {/* Withdraw Button */}
      <button className="w-full lg:w-auto h-12 bg-[#D67961] text-white font-medium px-6 rounded-lg hover:bg-[#C2684E] transition-colors active:scale-95">
        Withdraw to bank
      </button>
    </div>
  )
}
