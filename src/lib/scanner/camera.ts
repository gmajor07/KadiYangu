export type CameraPhase = "idle" | "starting" | "running" | "error";
export type CameraControls = {stop:()=>void};
type Decoder = {decodeFromStream:(stream:MediaStream,video:HTMLVideoElement,callback:(result?:{getText:()=>string})=>void)=>Promise<CameraControls>};
type CameraDependencies = {
  media: Pick<MediaDevices,"getUserMedia"|"enumerateDevices">;
  createDecoder: ()=>Promise<Decoder>;
};
export function cameraErrorMessage(error: unknown) {
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") return "Camera access was denied or blocked. Allow camera access in browser/site settings, then retry. Open this page directly over HTTPS (or localhost).";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No camera was found. Connect a camera or use another device. Manual entry is available below.";
  if (name === "NotReadableError" || name === "TrackStartError") return "Camera is unavailable or in use. Close other camera apps, check the connection and retry.";
  if (name === "OverconstrainedError") return "The selected camera is unavailable. Choose another camera and retry.";
  return "Camera could not start. Check browser support and camera permissions, then retry or use manual entry.";
}

// Own the stream BEFORE asynchronous decoding, so Stop/unmount also handles a
// late permission response. A stopped session can never reattach a live stream.
export class QrCameraSession {
  private stopped = false;
  private stream: MediaStream | null = null;
  private controls: CameraControls | null = null;
  private video: HTMLVideoElement | null = null;
  constructor(private readonly onCode:(value:string)=>void,private readonly onFailure:(error:unknown)=>void,private readonly deps:CameraDependencies = {
    media: navigator.mediaDevices,
    createDecoder: async()=> { const {BrowserQRCodeReader} = await import("@zxing/browser"); return new BrowserQRCodeReader(undefined,{delayBetweenScanAttempts:180,delayBetweenScanSuccess:1000}); },
  }) {}
  async start(video:HTMLVideoElement,deviceId?:string) {
    this.video=video;
    try {
      let stream:MediaStream;
      try {
        stream=await this.deps.media.getUserMedia({audio:false,video:deviceId ? {deviceId:{exact:deviceId}} : {facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}});
      } catch(error) {
        const name=error && typeof error === "object" && "name" in error ? error.name : "";
        if (this.stopped || deviceId || !["NotFoundError","OverconstrainedError"].includes(String(name))) throw error;
        stream=await this.deps.media.getUserMedia({audio:false,video:true});
      }
      if(this.stopped){stream.getTracks().forEach(track=>track.stop());return false;}
      this.stream=stream;
      stream.getVideoTracks().forEach(track=>track.addEventListener("ended",()=>{if(!this.stopped){this.stop();this.onFailure({name:"NotReadableError"});}}));
      video.srcObject=stream;video.muted=true;video.playsInline=true;
      await video.play();
      if(this.stopped)return false;
      const decoder=await this.deps.createDecoder();
      if(this.stopped)return false;
      const controls=await decoder.decodeFromStream(stream,video,result=>{if(!this.stopped && result)this.onCode(result.getText());});
      if(this.stopped){controls.stop();return false;}
      this.controls=controls;
      return true;
    }catch(error){this.stop();throw error;}
  }
  stop(){
    this.stopped=true;
    this.controls?.stop();this.controls=null;
    this.stream?.getTracks().forEach(track=>track.stop());this.stream=null;
    if(this.video){this.video.pause();this.video.srcObject=null;}
  }
}
