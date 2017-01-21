---
title:  "Create Your Own Cloud Storage with Raspberry PI"
date:   2017-01-21 9:59:00
tags:
- raspberry-pi
- cloud
- storage
- owncloud
- dropbox
- linux
- tinkering
---

Chance is you started using a file hosting service in the last couple of years, be it Dropbox, Google Drive, iCloud or OneDrive. These cloud storages offer a lot of advantages -- they allow you to quickly and effortlessly save your data, share them with other people, create backups, sync data between many of your devices and also collaborate on projects. However, these public services have certain disadvantages, mainly security and price, so you might want to manage your own cloud storage. In this post, I will show you how to create your own cloud storage with Raspberry PI and OwnCloud.

![OwnCloud logo]({{ site.url }}/img/posts/owncloud.png)

## Why I decided to create my own cloud storage

I have been using Dropbox for about three years, at first I didn't have much to complain about as it was free, but those 5 gigabytes that are free get used up quickly so in the last half a year I started paying €8.25 monthly for 1 terabyte. The pricing strategy of Dropbox makes it impossible to pay less for less space, it's either 5 GB for free or 1 TB for €8.25. That didn't bother me so much, though. What bothered me much more was the Dropbox hack that lead to leaking of millions of user passwords. I also have to say I am not very comfortable with handing my personal data to US companies anymore, I am not really paranoid but you know what they say, being paranoid doesn't mean they are not coming after you. Nevertheless, I could probably live with all that, the last straw that broke the camel's back was when I learned Dropbox is shamelessly [storing your user password](http://applehelpwriter.com/2016/08/29/discovering-how-dropbox-hacks-your-mac/) if you are using the Mac OS X client, and they manage to do it in a really disturbing way, see the linked article.

## Requirements

So now that we know there is a problem, what can we do about it? If you have a spare Raspberry PI lying around, thankfully, there is a way. You can use your Raspberry with OwnCloud to create your own home cloud storage. Let's first consider all the things you are going to need to make this happen:

* Raspberry PI (I have version 3 model B)
* Micro SD memory stick, preferably class 10 or higher (I have SanDisk Micro SDHC 16GB Ultra)
* External hard disk with USB interface (unless you don't mind limited capacity of the SD card)
* Case for Raspberry PI
* Power adapter (2.0 A at least, that external HDD will need quite a lot of current)
* Router you are in charge of

Optional requirements:

* Your own Internet domain
* RJ45 cable (to connect the Raspberry to your home router if you don't want to rely on Wi-Fi)

## Creating a cloud storage

Now that you have all that is required, you can start tinkering with your Raspberry to start servicing your own cloud storage. I will first list all the steps that are required and then walk you through them.

1. Install Raspbian
2. Install and configure OwnCloud
3. Connect your external HDD
4. Expose your cloud storage on the Internet

### Install Raspbian

You've probably already done this step before, but even so, I will briefly summarize (the official documentation is [here](https://www.raspberrypi.org/documentation/installation/installing-images/README.md)). Download the latest Raspbian image from the [official website](https://www.raspberrypi.org/downloads/raspbian/). You need to write the image to your SD card, if you use Linux, see [here](https://www.raspberrypi.org/documentation/installation/installing-images/linux.md). If you use other operating system, see [this page](https://www.raspberrypi.org/documentation/installation/installing-images/README.md). After you are done with that, you need to mount your SD card and create a file named `ssh` on the boot partition to enable ssh (unless you don't mind connecting your monitor and all other peripherals to your Raspberry). If you are going to access your Raspberry PI via Wi-Fi, you need to append the following configuration to file `/etc/wpa_supplicant/wpa_supplicant.conf` (you can find it on the root partition of your SD card):

{% highlight Bash shell scripts %}
network={
    ssid="<SSID-of-your-wifi>"
    psk="<your-wifi-password>"
}
{% endhighlight %}

See [this page](https://www.raspberrypi.org/documentation/configuration/wireless/wireless-cli.md) for more information. And that's it, now you can take the SD card, insert it into your Raspberry PI and boot it. You should be able to `ssh` to it with `ssh pi@<ip-address>`, you can find the IP address in your router administration or by doing an ARP scan (e.g. with `arp-scan --interface=eth0 --localnet`). After you successfully `ssh` to your Raspberry, you should also setup your device with `sudo raspi-config`.

### Install and configure OwnCloud

To install OwnCloud, it is definitely preferable to use standard packaging system of Debian so that you can keep it and it's dependencies up to date. It also happens to be the easiest way. First, you need to add the OwnCloud repository to Aptitude. If you have Raspbian based on Debian 8 (Jessie), you do this by running the following commands (as root):

{% highlight Bash shell scripts %}
wget -nv https://download.owncloud.org/download/repositories/stable/Debian_8.0/Release.key -O Release.key
apt-key add - < Release.key
sh -c "echo 'deb http://download.owncloud.org/download/repositories/stable/Debian_8.0/ /' > /etc/apt/sources.list.d/owncloud.list"
{% endhighlight %}

The frist two commands add the repository key to Aptitude. For other versions of Raspbian/Debian, see [this page](https://download.owncloud.org/download/repositories/stable/owncloud/). Now, to install OwnCloud, you just need to run the following commands as root (or use `sudo`):

{% highlight Bash shell scripts %}
apt update
apt install owncloud
{% endhighlight %}

During the installation, you will be asked to setup a root password for your MySQL database (which is a dependency of OwnCloud), choose a strong password. After the installation completes, OwnCloud should already be running. To verify that, go to `http://<ip_address_of_your_raspberry>/owncloud` in your web browser. When the page loads, you will be asked for administrator user name and password. You will also be asked to configure your data directory and database connection, choose MySQL as database and fill in the credentials that you filled in during installation. For data directory, keep the default for now.

You now have a working instance of OwnCloud. You should, however, configure memory caching to get better performance of the web interface. You can choose various caching systems, I chose Redis. See [this page](https://doc.owncloud.org/server/8.1/admin_manual/configuration_server/caching_configuration.html) for other caching systems. To configure Redis, you first need to install it:

{% highlight Bash shell scripts %}
apt install redis-server php5-redis
{% endhighlight %}

After the installation successfully completes, you need to configure it. Open file `/etc/redis/redis.conf` as root with your editor and configure the following properties as listed below:

{% highlight Bash shell scripts %}
port 0
unixsocket /tmp/redis.sock
unixsocketperm 777
{% endhighlight %}

You do this because your Redis instance runs on the same server (your Raspberry PI) as your OwnCloud instance, and using Unix sockets is faster than TCP. You need to restart Redis with `sudo service redis-server restart`. Now, you need to make sure OwnCloud communicates with Redis, so open file `/var/www/owncloud/config/config.php` as root, and append the following lines to the end of the array:

{% highlight PHP %}
'memcache.local' => '\OC\Memcache\Redis',
'redis' => array(
 'host' => '/tmp/redis.sock',
 'port' => 0,
  ),
'memcache.locking' => '\OC\Memcache\Redis'
{% endhighlight %}

When You are done with that, you just need to restart Apache with `sudo service apache2 restart`. to verify OwnCloud is working correctly with Redis, go to your OwnCloud administration page and you should see no errors about missing caching system.

### Connect your external HDD

Chance is you your memory card doesn't have enough space for your needs. If that is so, this section shows you how to configure your Raspberry PI to automatically mount your external HDD during startup and your OwnCloud to use it as a data directory. First, you need to format your HDD with ext4 file system (which is preferable, choose a different file system if you want, but be aware these instruction won't work), choose a label that you will remember. Second, connect your HDD to the Raspberry. Now, you need to find the UUID of your HDD, so run the following command in your PI:

{% highlight Bash shell scripts %}
sudo blkid
{% endhighlight %}

This will list mounted devices with their UUIDs, find the UUID of the device that has the label you chose during formatting and copy it to clipboard. Next, you need to edit `/etc/fstab`. First back it up with `sudo cp /etc/fstab /etc/fstab.old` so that you could restore it if something went wrong. Open the original file as root and append the following line at the end:

{% highlight Bash shell scripts %}
UUID=<uuid-of-your-hdd> /mnt/owncloud ext4 sync,auto,nofail,user,rw 0 0
{% endhighlight %}

This will make sure that the HDD is mounted after startup to `/mnt/owncloud` with the right permission but only if the HDD is connected. You also need to create `/mnt/owncloud` with `sudo mkdir /mnt/owncloud` and give it the correct permission with `chmod 777 /mnt/owncloud/`. Reboot the PI with `reboot`. After reboot, make sure the HDD is connected. Finally, you just need to copy the data directory of OwnCloud by running `sudo cp /var/www/owncloud/data /mnt/ownlcoud`, change the owner and group with `sudo chown -R www-data:www-data /mnt/owncloud/data` and update OwnCloud confiuration in `/var/www/owncloud/config/config.php` accordingly:

{% highlight PHP %}
'datadirectory' => '/mnt/owncloud/data/'
{% endhighlight %}

Restart the web server with `sudo service apache2 restart` and you are all set.

### Expose your cloud storage on the Internet

To expose your cloud storage over the Internet, you will need a Dynamic DNS. I use CloudFlare.com. To use CloudFlare, create an account and setup your DNS records for your domain name. When you have your CloudFlare account properly set up, crate a new DNS record for your Raspberry, you probably want to use a sub-domain of your domain (e.g. cloud.yourdomain.com) and point it to your current public IP (go to [ip.42.pl](http://ip.42.pl/raw)). Don't forget to disable CDN for this sub-domain.

Next, you need to set up your router to forward the necessary ports to your Raspberry PI (you are probably behind NAT, so routing to your public IP address won't connect to your PI by default). Go to your router administration and find a section where you can configure port forwarding. You should forward only ports that you are going to need, for http, that is 80 and for https, it is 443 (so choose e.g. 80-443, if you need ssh access over the Internet, you need port 22 also). Also, make sure your PI's local IP address is reserved. Now you can try that it works by opening [http://cloud.yourdomain.com/owncloud](http://cloud.yourdomain.com/owncloud) in your browser. If you don't want to use CloudFlare or you don't have your own domain, you can also use [duckdns.org](https://www.duckdns.org/).

It's likely you don't have a static IP address. If that is so, your public IP address might change any time (e.g. if you restart your router), which will no longer make your cloud available over the Internet. To fix it, you need to update your DNS record every time such change occurs. This can be accomplished by periodically running a script on your Raspberry that checks the current public IP address and compares it to the IP address in the DNS. If you use CloudFlare, you can use the `ddclient`, see [this page](https://www.cloudflare.com/technical-resources/#ddclient). Another option is to use a script I created, which you can find on my [GitHub page](https://github.com/VaclavDedik/cloudflare-dns-updater). To use the script, clone it on your PI:

{% highlight Bash shell scripts %}
git clone https://github.com/VaclavDedik/cloudflare-dns-updater.git
{% endhighlight %}

And modify the `crontab` and `run.sh` files. To find your API key, go to your CloudFlare settings. To find your zone id, run the following command:

{% highlight Bash shell scripts %}
curl -X GET "https://api.cloudflare.com/client/v4/zones"
     -H "X-Auth-Email: <your-email>"
     -H "X-Auth-Key: <your-api-key>"
     -H "Content-Type: application/json"
{% endhighlight %}

Now you just need to schedule periodic execution of the script by executing `crontab crontab` in your Raspberry. If there is any error, you will find new mail in file `/var/mail/pi`.

## What's next

Now you can start using your OwnCloud. It's a good idea to configure `ssl` though, you don't want anyone to spy on your sensitive data. With [certbot](https://certbot.eff.org/), it's really easy. If you have an extra HDD, you can also configure software RAID to prevent data loss. If you are really nuts about your data and you are afraid of natural disasters, you could setup another PI at a different geographical location with OwnCloud and configure it for cross-site failover.
