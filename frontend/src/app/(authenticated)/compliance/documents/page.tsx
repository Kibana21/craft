"use client";

import { useEffect, useState } from "react";
import { fetchDocuments, uploadDocument, deleteDocument, type ComplianceDocument } from "@/lib/api/compliance";

export default function ComplianceDocumentsPage() {
  const [docs, setDocs] = useState<ComplianceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: "", content: "", document_type: "mas_regulation" });

  const loadDocs = () => {
    fetchDocuments().then(setDocs).finally(() => setIsLoading(false));
  };

  useEffect(() => { loadDocs(); }, []);

  const handleUpload = async () => {
    await uploadDocument(newDoc);
    setNewDoc({ title: "", content: "", document_type: "mas_regulation" });
    setShowUpload(false);
    loadDocs();
  };

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    loadDocs();
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-[#222222]">Compliance Documents</h1>
          <p className="mt-1 text-base text-[#717171]">MAS regulations and product fact sheets for RAG-based compliance checking</p>
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="rounded-lg bg-[#D0103A] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-[#B80E33]"
        >
          + Upload document
        </button>
      </div>

      {showUpload && (
        <div className="mb-8 rounded-xl border border-[#EBEBEB] bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-[#222222]">Upload document</h3>
          <div className="space-y-4">
            <input
              type="text"
              value={newDoc.title}
              onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
              placeholder="Document title"
              className="w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base focus:border-[#222222] focus:outline-none focus:ring-0"
            />
            <select
              value={newDoc.document_type}
              onChange={(e) => setNewDoc({ ...newDoc, document_type: e.target.value })}
              className="rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base focus:border-[#222222] focus:outline-none focus:ring-0"
            >
              <option value="mas_regulation">MAS Regulation</option>
              <option value="product_fact_sheet">Product Fact Sheet</option>
              <option value="disclaimer">Disclaimer Template</option>
            </select>
            <textarea
              value={newDoc.content}
              onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
              placeholder="Paste document content here..."
              rows={6}
              className="w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base focus:border-[#222222] focus:outline-none focus:ring-0"
            />
            <button
              onClick={handleUpload}
              disabled={newDoc.title.length < 1 || newDoc.content.length < 10}
              className="rounded-lg bg-[#008A05] px-6 py-3 text-base font-semibold text-white disabled:opacity-40"
            >
              Upload
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-[#F7F7F7]" />)}</div>
      ) : docs.length > 0 ? (
        <div className="space-y-4">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-4 rounded-xl border border-[#EBEBEB] bg-white p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm text-white">📄</div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#222222]">{doc.title}</p>
                <p className="text-xs text-[#717171]">{doc.document_type.replace("_", " ")} · Chunk {doc.chunk_index}</p>
              </div>
              <button onClick={() => handleDelete(doc.id)} className="rounded-lg bg-[#FFF0F3] px-3 py-1.5 text-xs font-semibold text-[#D0103A] hover:bg-red-100">
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F7F7] text-3xl">📄</div>
          <h3 className="mt-4 text-lg font-semibold text-[#222222]">No documents uploaded</h3>
          <p className="mt-1 text-sm text-[#717171]">Upload MAS regulations for compliance checking</p>
        </div>
      )}
    </div>
  );
}
