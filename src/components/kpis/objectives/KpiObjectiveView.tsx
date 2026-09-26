import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Loader2, ListTree } from 'lucide-react';
import { kpiService } from '../../../services/kpi.service';
import { useAuth } from '../../../context/AuthContext';
import { KpiObjective } from '../../../types/kpi';
import { KpiObjectiveForm } from './KpiObjectiveForm';

const buildTree = (objectives: KpiObjective[]): KpiObjective[] => {
  const map = new Map<string, KpiObjective>();
  const roots: KpiObjective[] = [];

  objectives.forEach(obj => {
    map.set(obj.id, { ...obj, children: [] });
  });

  objectives.forEach(obj => {
    const node = map.get(obj.id);
    if (node) {
      if (obj.parent_objective_id) {
        const parent = map.get(obj.parent_objective_id);
        if (parent) {
          parent.children?.push(node);
        } else {
          roots.push(node); // Fallback if parent missing
        }
      } else {
        roots.push(node);
      }
    }
  });

  // Sort children
  const sortNodes = (nodes: KpiObjective[]) => {
    nodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    nodes.forEach(node => {
      if (node.children) {
        sortNodes(node.children);
      }
    });
  };
  
  sortNodes(roots);
  return roots;
};

export const KpiObjectiveView: React.FC = () => {
  const { systemRole, primaryUnit, isAdmin } = useAuth();
  const [objectives, setObjectives] = useState<KpiObjective[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState<KpiObjective | undefined>(undefined);
  const [parentObjectiveId, setParentObjectiveId] = useState<string | null>(null);

  const fetchObjectives = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await kpiService.getObjectives(undefined); // Fetch all or apply RLS
      if (error) throw error;
      setObjectives(data || []);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách mục tiêu');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchObjectives();
  }, [primaryUnit]);

  const tree = useMemo(() => buildTree(objectives), [objectives]);

  const handleOpenCreate = (parentId: string | null = null) => {
    setSelectedObjective(undefined);
    setParentObjectiveId(parentId);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (objective: KpiObjective) => {
    setSelectedObjective(objective);
    setParentObjectiveId(objective.parent_objective_id);
    setIsFormOpen(true);
  };

  const renderNode = (node: KpiObjective, depth: number) => {
    const isOwner = isAdmin || (systemRole === 'manager' && node.organization_unit_id === primaryUnit?.id);
    
    return (
      <div key={node.id} className="border-b border-slate-100 last:border-0">
        <div 
          className="flex items-center justify-between py-3 px-4 hover:bg-slate-50 transition-colors"
          style={{ paddingLeft: `${Math.max(1, depth) * 1.5}rem` }}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${depth === 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
              L{node.objective_level}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{node.code}</span>
                <span className="text-slate-600">{node.name}</span>
              </div>
              {node.description && (
                <p className="text-xs text-slate-500 mt-0.5">{node.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${node.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
              {node.status}
            </span>
            {isOwner && (
              <>
                <button
                  onClick={() => handleOpenCreate(node.id)}
                  className="text-slate-400 hover:text-indigo-600 p-1.5 transition-colors"
                  title="Thêm mục tiêu con"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleOpenEdit(node)}
                  className="text-slate-400 hover:text-indigo-600 p-1.5 transition-colors"
                  title="Chỉnh sửa"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
        {node.children && node.children.length > 0 && (
          <div className="flex flex-col">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Mục tiêu</h2>
          <p className="text-sm text-slate-500">Quản lý cây mục tiêu chiến lược</p>
        </div>
        {(isAdmin || systemRole === 'manager') && (
          <button
            onClick={() => handleOpenCreate(null)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Mục tiêu gốc
          </button>
        )}
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      ) : tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <ListTree className="h-12 w-12 text-slate-300 mb-3" />
          <p>Chưa có mục tiêu nào.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {tree.map(root => renderNode(root, 0))}
        </div>
      )}

      {isFormOpen && (
        <KpiObjectiveForm
          objective={selectedObjective}
          parentObjectiveId={parentObjectiveId}
          objectives={objectives}
          onClose={() => setIsFormOpen(false)}
          onSuccess={() => {
            setIsFormOpen(false);
            fetchObjectives();
          }}
        />
      )}
    </div>
  );
};
