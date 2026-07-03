import { useState } from "react";

export default function BuyerEnquiryModal({
    open,
    onClose,
    onSubmit,
    project
}) {

const [form,setForm]=useState({
    enquiry_type:"",
    category:"",
    location:"",
    budget_min:"",
    budget_max:"",
    description:"",
    priority:"Normal"
});

if(!open) return null;

const submit=()=>{
    onSubmit(form);
};

return(

<div className="modal-overlay">

<div className="modal-card">

<h2>Buyer Enquiry</h2>

<p>{project?.name}</p>

<label>Purpose</label>

<div>

<label>

<input
type="radio"
name="purpose"
value="Plots"
checked={form.enquiry_type==="Plots"}
onChange={(e)=>setForm({...form,enquiry_type:e.target.value})}
/>

Plots

</label>

<label>

<input
type="radio"
name="purpose"
value="House"
checked={form.enquiry_type==="House"}
onChange={(e)=>setForm({...form,enquiry_type:e.target.value})}
/>

House

</label>

<label>

<input
type="radio"
name="purpose"
value="Legal"
checked={form.enquiry_type==="Legal"}
onChange={(e)=>setForm({...form,enquiry_type:e.target.value})}
/>

Legal Issue

</label>

</div>

{form.enquiry_type==="House" && (

<select
value={form.category}
onChange={(e)=>setForm({...form,category:e.target.value})}
>

<option value="">Select</option>

<option>1 BHK</option>

<option>2 BHK</option>

<option>3 BHK</option>

<option>Villa</option>

<option>Apartment</option>

<option>Other</option>

</select>

)}

{form.enquiry_type==="Legal" && (

<select
value={form.category}
onChange={(e)=>setForm({...form,category:e.target.value})}
>

<option value="">Select</option>

<option>Document Disputes</option>

<option>DTCP Approval</option>

<option>Layout Approval</option>

<option>Patta</option>

<option>Encumbrance</option>

<option>Other</option>

</select>

)}

<input

placeholder="Preferred Location"

value={form.location}

onChange={(e)=>setForm({...form,location:e.target.value})}

/>

<input

type="number"

placeholder="Minimum Budget"

value={form.budget_min}

onChange={(e)=>setForm({...form,budget_min:e.target.value})}

/>

<input

type="number"

placeholder="Maximum Budget"

value={form.budget_max}

onChange={(e)=>setForm({...form,budget_max:e.target.value})}

/>

<textarea

maxLength={256}

rows={5}

placeholder="Describe your enquiry..."

value={form.description}

onChange={(e)=>setForm({...form,description:e.target.value})}

/>

<div>

<button onClick={submit}>

Send Enquiry

</button>

<button onClick={onClose}>

Cancel

</button>

</div>

</div>

</div>

);

}
