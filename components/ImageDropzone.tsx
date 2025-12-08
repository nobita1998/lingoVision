import React, { useCallback, useState, useRef } from 'react';

interface ImageDropzoneProps {
  onImageSelected: (base64: string) => void;
  text: any;
}

const ImageDropzone: React.FC<ImageDropzoneProps> = ({ onImageSelected, text }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- Camera Logic ---

  const startCamera = async () => {
    setIsProcessing(true);
    try {
      let stream: MediaStream;
      
      try {
        // 1. Try environment facing mode with 'ideal' to allow fallback
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: { ideal: 'environment' } } 
        });
      } catch (envError) {
        console.warn("Rear camera preference failed, falling back to any video.", envError);
        // 2. Fallback to any available video input
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
      }
      
      streamRef.current = stream;
      setIsCameraOpen(true);
      setIsProcessing(false);
      
      // Allow a moment for the modal/div to render before attaching the stream
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Explicitly attempt to play to ensure dimensions are available
          videoRef.current.play().catch(e => console.error("Video play error:", e));
        }
      }, 100);

    } catch (err) {
      console.error("Error accessing camera:", err);
      setIsProcessing(false);
      setIsCameraOpen(false);
      alert("Could not access camera. Please ensure permissions are granted and no other app is using it.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
    setIsProcessing(false); // Ensure we don't get stuck in processing if manually closed
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    // We capture synchronously to avoid race conditions with React state updates unmounting the video
    try {
      // Check if video has valid dimensions
      if (video.videoWidth === 0 || video.videoHeight === 0) {
           console.warn("Video dimensions are 0");
           alert("Camera is not ready yet. Please wait a moment and try again.");
           return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 (JPEG 0.8 quality for smaller size)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        // Stop camera stream
        stopCamera();
        
        // Pass to parent
        onImageSelected(dataUrl);
      } else {
          throw new Error("Could not get canvas context");
      }
    } catch (err) {
      console.error("Capture failed:", err);
      alert("Failed to capture photo. Please try again.");
    }
  };

  // --- Drag & Drop / File Logic ---

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onImageSelected(result);
    };
    reader.onerror = () => {
      setIsProcessing(false);
      alert("Error reading file");
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [onImageSelected]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // --- Render ---

  if (isProcessing) {
    return (
      <div className="relative w-full h-80 border-4 border-black rounded-3xl flex flex-col items-center justify-center text-center bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="animate-bounce mb-4">
           {/* Cute Loading Icon */}
           <div className="w-16 h-16 bg-pink-400 rounded-full border-4 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
             <svg className="w-8 h-8 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
           </div>
        </div>
        <p className="text-xl font-black text-black animate-pulse">{text.processing || 'Processing...'}</p>
      </div>
    );
  }

  if (isCameraOpen) {
    return (
      <div className="relative w-full h-80 bg-black rounded-3xl overflow-hidden flex flex-col items-center justify-center border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Camera Controls Overlay */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-8 z-20">
           <button 
             type="button"
             onClick={stopCamera}
             className="bg-red-500 border-2 border-black text-white rounded-full p-3 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-none"
             title="Cancel"
           >
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
           
           <button 
             type="button"
             onClick={capturePhoto}
             className="group relative flex items-center justify-center"
             title="Capture"
           >
             <div className="w-20 h-20 rounded-full bg-white border-4 border-black transition-transform group-hover:scale-105 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"></div>
             <div className="absolute w-16 h-16 bg-red-500 rounded-full border-2 border-black group-active:scale-90 transition-transform"></div>
           </button>

           <div className="w-12"></div>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative w-full h-80 border-4 border-dashed rounded-3xl flex flex-col items-center justify-center text-center transition-all duration-300
        ${isDragging 
          ? 'border-indigo-600 bg-indigo-50 scale-105' 
          : 'border-slate-400 bg-white hover:border-indigo-500 hover:bg-slate-50'}
        shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]
      `}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
        title="Upload Image"
      />
      
      <div className="p-6 w-full flex flex-col items-center justify-center h-full relative z-10 pointer-events-none">
        
        {/* Upload Graphics */}
        <div className={`w-16 h-16 mb-4 rounded-2xl border-2 border-black flex items-center justify-center transition-colors shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] ${isDragging ? 'bg-indigo-300 text-white' : 'bg-yellow-300 text-black'}`}>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        
        <p className="text-xl font-black text-slate-800">
          {text.uploadDragDrop}
        </p>
        <p className="text-base font-medium text-slate-500 mt-1 mb-4">
          {text.uploadSubtext}
        </p>

        {/* Divider */}
        <div className="flex items-center gap-3 w-full max-w-[200px] my-3">
          <div className="h-1 bg-slate-300 flex-1 rounded-full"></div>
          <span className="text-sm font-black text-slate-400 uppercase tracking-wider">{text.orDivider}</span>
          <div className="h-1 bg-slate-300 flex-1 rounded-full"></div>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault(); 
            startCamera();
          }}
          className="pointer-events-auto flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-400 text-white rounded-xl font-bold border-2 border-black text-base transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px]"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {text.cameraButton}
        </button>
      </div>
    </div>
  );
};

export default ImageDropzone;