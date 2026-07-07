(() => {

const canvas = document.createElement("canvas");
canvas.id = "matrix-rain";

Object.assign(canvas.style,{
    position:"fixed",
    top:0,
    left:0,
    width:"100%",
    height:"100%",
    zIndex:"-999",
    pointerEvents:"none",
    opacity:"0.22"
});

document.body.prepend(canvas);

const ctx = canvas.getContext("2d");

let width;
let height;
let columns;
let drops;

const chars =
"アァカサタナハマヤャラワ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&@";

function resize(){

    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;

    columns = Math.floor(width / 18);

    drops = [];

    for(let i=0;i<columns;i++){

        drops[i] = Math.random()*height;

    }

}

window.addEventListener("resize",resize);

resize();

function draw(){

    ctx.fillStyle="rgba(0,0,0,0.05)";
    ctx.fillRect(0,0,width,height);

    ctx.shadowColor="#00ff41";
    ctx.shadowBlur=10;

    ctx.fillStyle="#00ff41";
    ctx.font="16px JetBrains Mono";

    for(let i=0;i<drops.length;i++){

        const text = chars[Math.floor(Math.random()*chars.length)];

        const x = i*18;
        const y = drops[i];

        ctx.fillText(text,x,y);

        if(y>height && Math.random()>0.975){

            drops[i]=0;

        }else{

            drops[i]+=Math.random()*18+10;

        }

    }

    requestAnimationFrame(draw);

}

draw();

})();
