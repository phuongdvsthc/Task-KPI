import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { kpiActualService, KpiManualActualPayload } from '../../../services/kpiActualService';

interface Props {
  bindingId: string;
  measurementType: string;
  requireNote: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const KpiManualActualModal: React.FC<Props> = ({ bindingId, measurementType, requireNote, onClose, onSuccess }) => {
  const [valueNumeric, setValueNumeric] = useState<string>('');
  const [valueText, setValueText] = useState<string>('');
  const [valueBoolean, setValueBoolean] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requireNote && (!note || note.trim() === '')) {
      setError('Vui lòng nhập ghi chú (bắt buộc).');
      return;
    }
    
    let payload: KpiManualActualPayload = { assignment_item_binding_id: bindingId, note };

    if (measurementType === 'number' || measurementType === 'percentage') {
      const num = parseFloat(valueNumeric);
      if (isNaN(num)) {
        setError('Vui lòng nhập một số hợp lệ.');
        return;
      }
      payload.value_numeric = num;
    } else if (measurementType === 'boolean') {
      payload.value_boolean = valueBoolean;
    } else {
      if (!valueText || valueText.trim() === '') {
        setError('Vui lòng nhập giá trị.');
        return;
      }
      payload.value_text = valueText;
    }

    setLoading(true);
    setError(null);
    const { error: submitErr } = await kpiActualService.submitManualActual(payload);
    setLoading(false);

    if (submitErr) {
      setError(submitErr.message);
    } else {
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-900">Cập nhật Actual (Thủ công)</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg flex items-start gap-2 text-sm border border-red-100">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form id="manual-form" onSubmit={handleSubmit} className="space-y-4">
            {(measurementType === 'number' || measurementType === 'percentage') && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Giá trị ({measurementType === 'percentage' ? '%' : 'Số'})
                </label>
                <input
                  type="number"
                  step="any"
                  value={valueNumeric}
                  onChange={e => setValueNumeric(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800"
                  placeholder="Nhập giá trị số..."
                  required
                />
              </div>
            )}

            {measurementType === 'boolean' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Giá trị Đạt/Không đạt</label>
                <select
                  value={valueBoolean ? 'true' : 'false'}
                  onChange={e => setValueBoolean(e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800"
                >
                  <option value="true">Đạt (Có)</option>
                  <option value="false">Không đạt (Không)</option>
                </select>
              </div>
            )}

            {(measurementType !== 'number' && measurementType !== 'percentage' && measurementType !== 'boolean') && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Giá trị chữ/văn bản</label>
                <input
                  type="text"
                  value={valueText}
                  onChange={e => setValueText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800"
                  placeholder="Nhập giá trị..."
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Ghi chú / Minh chứng {requireNote && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-slate-800 min-h-[100px]"
                placeholder={requireNote ? "Bắt buộc nhập ghi chú / link minh chứng..." : "Nhập ghi chú (không bắt buộc)..."}
                required={requireNote}
              />
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-200/50 rounded-lg transition-colors text-sm"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="manual-form"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Đang lưu...' : 'Lưu giá trị'}
          </button>
        </div>
      </div>
    </div>
  );
};
