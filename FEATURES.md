
Overview

ASY Beauté CRM helps the salon owner track every customer visit in one place: who came in, what services were performed, how much was charged, and how the customer felt about it. Over time it surfaces revenue trends, flags customers who haven't returned in over 90 days, and gives a complete history of every client at a glance.

Data is stored in Supabase (PostgreSQL), which can be backup to a local macbook.
Sign-in is via magic link — no password required. Only pre-registered accounts can sign in.

===
Features

1. Dashboard — 30-day revenue, visit counts, new customer count, and a lapsed-customer re-engagement list
2 .Revenue analytics — all-time revenue and booking counts broken down by service, rendered as bar charts
3. Visit recording — log any combination of services with automatic pricing, optional price override, star rating, customer feedback, private notes, follow-up scheduling, and photo count
4. Customer search — filter by name, phone, service type, or engagement status (new / active / lapsed); sort by most recent, highest spend, most visits, or name
5. Customer profiles — full visit timeline, lifetime value, average rating, services breakdown, and editable notes
6. Theming — switchable colour palette (blue / rose / sage), row density, and corner radius via a floating tweaks panel
7. Stock-check - user can update and check the balance of inventory
8. Reservation - a booking system.
9. Interface and input would be English and Traditional Chinese. 

===
[Page] Customer Booking 
Record the name, phone number, date of booking, beauty service options [checkbox]

Beauty Services and follow up booking:
1. Areola
2. VIO
3. Lip
4. Body treatment (Underarm, Leg, Others)

Follow up booking can be updated anytime.
For Areola, and VIO, there are 5 follow up visits:
1 week, 2 week, 1 month, 6 weeks, 2 months after the service

For Lip, there are 3 follow visits:
1 week, 2 week, 1 month

For Body treatment, there will be 1 follow up visit:
3 weeks

===
[Page] Stock-check

We need to maintain the inventory of these 5 products:
1. AL1
2. AL2
3. B2
4. N2
5. P1

reference: ./sample_images/Inventory.PNG
===
[Page] Reservation / Booking

A booking page would include the date and time for the appointment.
The type of treatments, according to the beauty services defined above. 
Additonal notes for this appointment or for the client. 

===
[Page] Customer List

Showing all the customers at a glance. 
We can drill down to a customer to see the Customer details. 

Reference: ./sample_images/customer_list.PNG
===
[Page] Customer Details

Showing Customer record and other details info
We may not have the image of the customer, showing photo is optional 
Reference: ./sample_images/customer_details.PNG
===
[Page] Customer Record

Showing Recent Customer visiting records order by dates (new to old)  
We can drill down to see the Customer Details

Reference: ./sample_images/customer_record.PNG
===
[Page] Income and Expense

A page focusing on income and expense, 
Each item would be classified as expense or income, show date, with payment method, amount, name, service or payment item, etc.   

Reference: ./sample_images/income_and_expense.PNG
====
[Page] Statistics
A dash board showing graphs and table for user to understand more about the business, trends, or customers. 

====
[Page] Setting
Certain Theme or fonts size you can tune the app

===

On the side bar, showing the "ASY BEAUTE" Studio logo.
Moto: "用心對待每一位客人，讓美麗與專業業同行。"
User can navigate to different pages from the side bar. 





