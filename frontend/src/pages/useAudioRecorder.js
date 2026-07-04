import { useState, useRef } from "react";

export function useAudioRecorder() {
  const [estaGrabando, setEstaGrabando] = useState(false);
  const [volumenVoz, setVolumenVoz] = useState(new Array(15).fill(5)); 
  const [audioUrl, setAudioUrl] = useState(null); 
  const [audioBlobReal, setAudioBlobReal] = useState(null); 

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);

  const iniciarGrabacionHardware = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const opciones = MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : {};
      const mediaRecorder = new MediaRecorder(stream, opciones);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          const tipoReal = mediaRecorder.mimeType || "audio/webm";
          const blobTemporal = new Blob(audioChunksRef.current, { type: tipoReal });
          setAudioBlobReal(blobTemporal); 
          setAudioUrl(URL.createObjectURL(blobTemporal)); 
        }
      };

      mediaRecorder.start(); 

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 32; 

      source.connect(analyser);
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      setEstaGrabando(true);
      analizarFrecuenciaVoz();
    } catch (err) {
      console.error("Error al acceder al micrófono:", err);
      alert("❌ No se detectó señal del micrófono.");
    }
  };

  const pausarGrabacionHardware = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.requestData(); 
      mediaRecorderRef.current.pause(); 
      setEstaGrabando(false);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const reanudarGrabacionHardware = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume(); 
      setEstaGrabando(true);
      analizarFrecuenciaVoz(); 
    } else if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      iniciarGrabacionHardware(); 
    }
  };

  const analizarFrecuenciaVoz = () => {
    if (!analyserRef.current || !streamRef.current) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let ultimaActualizacion = Date.now();

    const renderOnda = () => {
      if (!analyserRef.current) return;
      const ahora = Date.now();
      
      if (ahora - ultimaActualizacion >= 100) {
        analyserRef.current.getByteFrequencyData(dataArray);
        const volumenesMapeados = Array.from(dataArray).slice(0, 15).map(v => Math.max(5, (v / 255) * 45));
        setVolumenVoz(volumenesMapeados.length === 15 ? volumenesMapeados : new Array(15).fill(5));
        ultimaActualizacion = ahora; 
      }
      animationFrameRef.current = requestAnimationFrame(renderOnda);
    };
    renderOnda();
  };

  const detenerGrabacionHardware = (descartar = false) => {
    setEstaGrabando(false);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setVolumenVoz(new Array(15).fill(5));
    if (descartar) {
      setAudioUrl(null);
      setAudioBlobReal(null);
    }
  };

  return {
    estaGrabando,
    volumenVoz,
    audioUrl,
    audioBlobReal,
    setAudioUrl,
    setAudioBlobReal,
    setVolumenVoz,
    iniciarGrabacionHardware,
    pausarGrabacionHardware,
    reanudarGrabacionHardware,
    detenerGrabacionHardware
  };
}