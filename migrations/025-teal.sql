-- The lime group colour was the same as the app's buttons; those groups become deep teal.
UPDATE groups SET color='#1E9E94' WHERE upper(color)='#D7F25A';
