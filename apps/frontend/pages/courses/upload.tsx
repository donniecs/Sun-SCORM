/**
 * CHANGE LOG - 2025-07-14 19:20
 * =========================
 * WHAT: Updated upload.tsx to integrate with Phase 5 course persistence
 * WHY: Phase 5 requirement to transform upload metadata into persisted database records
 * IMPACT: Uploaded courses now persist to database and redirect to dashboard
 * NOTES FOR CHATGPT: Added course creation API call after successful upload
 */

import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Navbar from '../../components/Navbar';
import { CourseUploadResponse, CourseUploadApiResponse, CreateCourseRequest } from '../../../../packages/types/src/Course';

export default function CourseUpload() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<CourseUploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Redirect if not authenticated
  React.useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  const handleFileSelect = (file: File) => {
    if (file?.name.toLowerCase().endsWith('.zip')) {
      setSelectedFile(file);
      setError(null);
      setUploadResult(null);
    } else {
      setError('Please select a ZIP file');
      setSelectedFile(null);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('course', selectedFile);

      const response = await fetch('http://localhost:3003/upload', {
        method: 'POST',
        body: formData,
        headers: {
          // Note: Don't set Content-Type header when using FormData
          // The browser will set it automatically with boundary
        }
      });

      const result: CourseUploadApiResponse = await response.json();

      if (result.success && result.data) {
        setUploadResult(result.data);
        setSelectedFile(null);

        // Persist course data to database
        const createResponse = await fetch('http://localhost:3003/courses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: result.data.title,
            version: result.data.version,
            fileCount: result.data.fileCount,
            structure: result.data.structure,
          } as CreateCourseRequest),
        });

        if (!createResponse.ok) {
          throw new Error('Failed to persist course data');
        }

        // Optionally, you can redirect to the dashboard or show a success message
        router.push('/dashboard');
      } else {
        setError(result.error?.message || 'Upload failed');
      }
    } catch (err) {
      setError('Network error: Unable to upload file');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Course Upload - Rustici Killer</title>
        <meta name="description" content="Upload SCORM courses to Rustici Killer" />
      </Head>
      
      <Navbar />
      
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-gray-900">📦 Course Upload</h1>
              <p className="mt-1 text-sm text-gray-600">
                Upload SCORM course packages to process and validate content
              </p>
            </div>
            
            <div className="p-6">
              {/* Upload Area */}
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center transition-colors border-gray-300 hover:border-gray-400"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="mx-auto h-12 w-12 text-gray-400">
                  <svg
                    className="h-12 w-12"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-medium text-gray-900">
                  Drop your SCORM course here
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Or click to browse and select a ZIP file
                </p>
                
                <input
                  type="file"
                  accept=".zip"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
                >
                  Browse Files
                </label>
                
                {selectedFile && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="text-red-500 hover:text-red-700"
                        title="Remove file"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Upload Button */}
              {selectedFile && (
                <div className="mt-6">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      '🚀 Upload & Process Course'
                    )}
                  </button>
                </div>
              )}
              
              {/* Error Display */}
              {error && (
                <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex">
                    <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">Upload Error</h3>
                      <p className="mt-1 text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Success Result */}
              {uploadResult && (
                <div className="mt-6 p-6 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex">
                    <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="ml-3 w-full">
                      <h3 className="text-sm font-medium text-green-800">Course Processed Successfully!</h3>
                      
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-green-800">Course Information</h4>
                          <dl className="mt-2 space-y-1">
                            <div className="flex justify-between">
                              <dt className="text-sm text-green-700">Title:</dt>
                              <dd className="text-sm font-medium text-green-900">{uploadResult.title}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-sm text-green-700">Version:</dt>
                              <dd className="text-sm font-medium text-green-900">{uploadResult.version}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-sm text-green-700">Files:</dt>
                              <dd className="text-sm font-medium text-green-900">{uploadResult.fileCount}</dd>
                            </div>
                          </dl>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-green-800">Course Structure</h4>
                          <div className="mt-2 max-h-32 overflow-y-auto">
                            <ul className="text-xs text-green-700 space-y-1">
                              {uploadResult.structure.map((file, index) => (
                                <li key={`${file}-${index}`} className="truncate">{file}</li>
                              ))}
                              {uploadResult.structure.length === 50 && (
                                <li className="text-green-600 italic">... and more files</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-green-200">
                        <button
                          onClick={() => {
                            setUploadResult(null);
                            setSelectedFile(null);
                          }}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        >
                          Upload Another Course
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
